import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { Db } from "../db";
import { Actor, managers, operators, permit, distributorScope } from "../auth";
import { parse, minor, quantity, text } from "../validation";
import { audit, checkDistributor, journal, moneyLine, Tx } from "./common";
import { randomUUID } from "node:crypto";
export async function defaultWarehouse(tx: Tx, distributorId: string) {
  return tx.warehouse.upsert({
    where: { code: `MAIN-${distributorId}` },
    create: {
      code: `MAIN-${distributorId}`,
      name: "Main distribution warehouse",
      distributorId,
    },
    update: {},
  });
}
export async function ensureBatches(
  tx: Tx,
  distributorId: string,
  skuId: string,
) {
  const stock = await tx.distributorStock.findUnique({
    where: { distributorId_skuId: { distributorId, skuId } },
  });
  if (!stock) return;
  const tracked = await tx.stockBatch.aggregate({
    where: { skuId, status: "AVAILABLE", warehouse: { distributorId } },
    _sum: { qty: true },
  });
  const qty = stock.qty - (tracked._sum.qty || 0);
  if (qty <= 0) return;
  const warehouse = await defaultWarehouse(tx, distributorId);
  await tx.stockBatch.upsert({
    where: {
      warehouseId_skuId_lot: {
        warehouseId: warehouse.id,
        skuId,
        lot: "OPENING-UNBATCHED",
      },
    },
    create: { warehouseId: warehouse.id, skuId, lot: "OPENING-UNBATCHED", qty },
    update: { qty: { increment: qty } },
  });
}
export async function addBatch(
  tx: Tx,
  data: {
    warehouseId: string;
    skuId: string;
    lot: string;
    qty: number;
    unitCostMinor: number;
    expiresOn: Date | null;
    status?: string;
    originBatchIds?: string[];
  },
) {
  const existing = await tx.stockBatch.findUnique({
    where: {
      warehouseId_skuId_lot: {
        warehouseId: data.warehouseId,
        skuId: data.skuId,
        lot: data.lot,
      },
    },
  });
  if (
    existing &&
    (existing.unitCostMinor !== data.unitCostMinor ||
      existing.expiresOn?.getTime() !== data.expiresOn?.getTime() ||
      existing.status !== (data.status || "AVAILABLE"))
  )
    throw new ConflictException(
      "Existing lot has a different cost, expiry or disposition",
    );
  return tx.stockBatch.upsert({
    where: {
      warehouseId_skuId_lot: {
        warehouseId: data.warehouseId,
        skuId: data.skuId,
        lot: data.lot,
      },
    },
    create: data,
    update: { qty: { increment: data.qty } },
  });
}
export async function reserveBatches(
  tx: Tx,
  distributorId: string,
  lineId: string,
  skuId: string,
  paid: number,
  free: number,
) {
  const batches = await tx.stockBatch.findMany({
    where: {
      skuId,
      status: "AVAILABLE",
      qty: { gt: 0 },
      warehouse: { distributorId, active: true },
      OR: [{ expiresOn: null }, { expiresOn: { gt: new Date() } }],
    },
    orderBy: [
      { expiresOn: { sort: "asc", nulls: "last" } },
      { receivedAt: "asc" },
      { id: "asc" },
    ],
  });
  let paidLeft = paid,
    freeLeft = free;
  for (const batch of batches) {
    if (!paidLeft && !freeLeft) break;
    const qty = Math.min(batch.qty, paidLeft),
      bonus = Math.min(batch.qty - qty, freeLeft);
    if (!qty && !bonus) continue;
    await tx.stockBatch.update({
      where: { id: batch.id },
      data: { qty: { decrement: qty + bonus } },
    });
    await tx.batchAllocation.create({
      data: { orderLineId: lineId, batchId: batch.id, qty, freeQty: bonus },
    });
    paidLeft -= qty;
    freeLeft -= bonus;
  }
  if (paidLeft || freeLeft)
    throw new ConflictException(
      "Insufficient unexpired stock after batch reservation",
    );
}
export async function restoreBatches(
  tx: Tx,
  distributorId: string,
  line: {
    id: string;
    skuId: string;
    allocatedQty: number;
    allocatedFreeQty: number;
  },
) {
  const allocations = await tx.batchAllocation.findMany({
    where: { orderLineId: line.id, restored: false },
    include: { batch: true },
  });
  let sellable = 0;
  if (!allocations.length) {
    const warehouse = await defaultWarehouse(tx, distributorId),
      qty = line.allocatedQty + line.allocatedFreeQty;
    await addBatch(tx, {
      warehouseId: warehouse.id,
      skuId: line.skuId,
      lot: "OPENING-UNBATCHED",
      qty,
      unitCostMinor: 0,
      expiresOn: null,
    });
    return qty;
  }
  for (const a of allocations) {
    const qty = a.qty + a.freeQty;
    await tx.stockBatch.update({
      where: { id: a.batchId },
      data: { qty: { increment: qty } },
    });
    await tx.batchAllocation.update({
      where: { id: a.id },
      data: { restored: true },
    });
    if (
      a.batch.status === "AVAILABLE" &&
      (!a.batch.expiresOn || a.batch.expiresOn > new Date())
    )
      sellable += qty;
  }
  return sellable;
}
@Injectable()
export class WarehouseService {
  constructor(@Inject(Db) private db: Db) {}
  async create(u: Actor, body: unknown) {
    permit(u, managers);
    const d = parse(
      z.object({
        name: text,
        code: text,
        distributorId: text,
        address: text,
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      }),
      body,
    );
    return this.db.serial(async (tx) => {
      await checkDistributor(tx, u, d.distributorId);
      return tx.warehouse.create({ data: d });
    });
  }
  async bootstrap(u: Actor) {
    const expired = await this.db.stockBatch.findMany({
      where: {
        status: "AVAILABLE",
        expiresOn: { lte: new Date() },
        warehouse: { distributor: distributorScope(u) },
      },
      select: { id: true },
    });
    for (const lot of expired)
      await this.db.serial(async (tx) => {
        const b = await tx.stockBatch.findUnique({
          where: { id: lot.id },
          include: { warehouse: true },
        });
        if (!b || b.status !== "AVAILABLE") return;
        await tx.stockBatch.update({
          where: { id: b.id },
          data: { status: "EXPIRED" },
        });
        await tx.distributorStock.update({
          where: {
            distributorId_skuId: {
              distributorId: b.warehouse.distributorId,
              skuId: b.skuId,
            },
          },
          data: { qty: { decrement: b.qty } },
        });
        await audit(tx, { ...u, id: "SYSTEM" }, "BATCH_EXPIRED", b.id, {
          qty: b.qty,
        });
      });
    const stocks = await this.db.distributorStock.findMany({
      where: { distributor: distributorScope(u) },
    });
    for (const s of stocks)
      await this.db.serial((tx) => ensureBatches(tx, s.distributorId, s.skuId));
  }
  async batchStatus(u: Actor, id: string, body: unknown) {
    permit(u, managers);
    const d = parse(
      z.object({
        status: z.enum(["AVAILABLE", "QUARANTINED", "RECALLED", "EXPIRED"]),
        reason: z.string().trim().min(10).max(500),
      }),
      body,
    );
    return this.db.serial(async (tx) => {
      const b = await tx.stockBatch.findFirst({
        where: { id, warehouse: { distributor: distributorScope(u) } },
        include: { warehouse: true },
      });
      if (!b) throw new NotFoundException();
      if (b.status === d.status) return b;
      if (d.status === "AVAILABLE" && b.expiresOn && b.expiresOn <= new Date())
        throw new ConflictException("Expired stock cannot be released");
      if (b.status === "RECALLED" && d.status === "AVAILABLE")
        throw new ConflictException(
          "Recalled lots cannot be released directly",
        );
      if (d.status === "RECALLED") {
        const derived = await tx.stockBatch.findMany({
          where: {
            id: { not: id },
            OR: [
              { originBatchIds: { has: id } },
              {
                skuId: b.skuId,
                lot: b.lot,
                warehouse: { distributorId: b.warehouse.distributorId },
              },
            ],
            status: { not: "RECALLED" },
          },
          include: { warehouse: true },
        });
        for (const lot of derived) {
          if (lot.status === "AVAILABLE")
            await tx.distributorStock.update({
              where: {
                distributorId_skuId: {
                  distributorId: lot.warehouse.distributorId,
                  skuId: lot.skuId,
                },
              },
              data: { qty: { decrement: lot.qty } },
            });
          await tx.stockBatch.update({
            where: { id: lot.id },
            data: { status: "RECALLED" },
          });
          await audit(tx, u, "DERIVED_LOT_RECALLED", lot.id, {
            originBatchId: id,
          });
        }
      }
      const difference =
        (d.status === "AVAILABLE" ? b.qty : 0) -
        (b.status === "AVAILABLE" ? b.qty : 0);
      if (difference)
        await tx.distributorStock.update({
          where: {
            distributorId_skuId: {
              distributorId: b.warehouse.distributorId,
              skuId: b.skuId,
            },
          },
          data: { qty: { increment: difference } },
        });
      await audit(tx, u, `BATCH_${d.status}`, id, {
        reason: d.reason,
        quantity: b.qty,
      });
      return tx.stockBatch.update({
        where: { id },
        data: { status: d.status },
      });
    });
  }
  async transfer(u: Actor, body: unknown) {
    permit(u, operators);
    const d = parse(
      z.object({
        clientId: z.uuid(),
        batchId: text,
        targetWarehouseId: text,
        qty: quantity,
      }),
      body,
    );
    return this.db.serial(async (tx) => {
      const existing = await tx.stockTransfer.findUnique({
        where: { clientId: d.clientId },
      });
      if (existing) {
        if (existing.requestedBy !== u.id) throw new ConflictException();
        return existing;
      }
      const b = await tx.stockBatch.findFirst({
        where: {
          id: d.batchId,
          warehouse: { distributor: distributorScope(u) },
        },
        include: { warehouse: true },
      });
      const target = await tx.warehouse.findFirst({
        where: {
          id: d.targetWarehouseId,
          active: true,
          distributor: distributorScope(u),
        },
      });
      if (!b || !target) throw new NotFoundException();
      if (
        b.warehouseId === target.id ||
        b.warehouse.distributorId !== target.distributorId
      )
        throw new BadRequestException(
          "Transfer requires different warehouses belonging to the same distributor",
        );
      if (
        b.status !== "AVAILABLE" ||
        (b.expiresOn && b.expiresOn <= new Date()) ||
        d.qty > b.qty
      )
        throw new ConflictException("Insufficient transferable batch stock");
      const t = await tx.stockTransfer.create({
        data: {
          ...d,
          number: `TR-${randomUUID().slice(0, 8).toUpperCase()}`,
          requestedBy: u.id,
        },
      });
      await audit(tx, u, "TRANSFER_REQUESTED", t.id);
      return t;
    });
  }
  async transferAction(u: Actor, id: string, status: string) {
    permit(u, operators);
    return this.db.serial(async (tx) => {
      const t = await tx.stockTransfer.findFirst({
        where: {
          id,
          batch: { warehouse: { distributor: distributorScope(u) } },
        },
        include: { batch: { include: { warehouse: true } } },
      });
      if (!t) throw new NotFoundException();
      if (status === "IN_TRANSIT" && t.status === "REQUESTED") {
        permit(u, managers);
        if (
          t.batch.status !== "AVAILABLE" ||
          (t.batch.expiresOn && t.batch.expiresOn <= new Date()) ||
          t.batch.qty < t.qty
        )
          throw new ConflictException(
            "Stock changed since the transfer request",
          );
        await tx.stockBatch.update({
          where: { id: t.batchId },
          data: { qty: { decrement: t.qty } },
        });
        await tx.distributorStock.update({
          where: {
            distributorId_skuId: {
              distributorId: t.batch.warehouse.distributorId,
              skuId: t.batch.skuId,
            },
          },
          data: { qty: { decrement: t.qty } },
        });
      } else if (status === "RECEIVED" && t.status === "IN_TRANSIT") {
        const expiry = t.batch.expiresOn && t.batch.expiresOn <= new Date();
        const batchStatus = expiry ? "EXPIRED" : t.batch.status;
        await addBatch(tx, {
          warehouseId: t.targetWarehouseId,
          skuId: t.batch.skuId,
          lot: t.batch.lot,
          qty: t.qty,
          unitCostMinor: t.batch.unitCostMinor,
          expiresOn: t.batch.expiresOn,
          status: batchStatus,
          originBatchIds: Array.from(
            new Set([t.batchId, ...t.batch.originBatchIds]),
          ),
        });
        if (batchStatus === "AVAILABLE")
          await tx.distributorStock.update({
            where: {
              distributorId_skuId: {
                distributorId: t.batch.warehouse.distributorId,
                skuId: t.batch.skuId,
              },
            },
            data: { qty: { increment: t.qty } },
          });
      } else if (!(status === "CANCELLED" && t.status === "REQUESTED"))
        throw new ConflictException("Invalid transfer transition");
      await audit(tx, u, `TRANSFER_${status}`, id, { qty: t.qty });
      return tx.stockTransfer.update({
        where: { id },
        data: {
          status,
          ...(status === "IN_TRANSIT"
            ? { approvedBy: u.id }
            : status === "RECEIVED"
              ? { receivedBy: u.id }
              : {}),
        },
      });
    });
  }
  async count(u: Actor, body: unknown) {
    permit(u, operators);
    const d = parse(
      z.object({
        warehouseId: text,
        notes: z.string().max(500).default(""),
        lines: z
          .array(
            z.object({
              batchId: text,
              countedQty: z.number().int().min(0).max(1000000),
            }),
          )
          .min(1)
          .max(200),
      }),
      body,
    );
    if (new Set(d.lines.map((l) => l.batchId)).size !== d.lines.length)
      throw new BadRequestException("Duplicate batch");
    return this.db.serial(async (tx) => {
      const warehouse = await tx.warehouse.findFirst({
        where: { id: d.warehouseId, distributor: distributorScope(u) },
      });
      if (!warehouse) throw new NotFoundException();
      const batches = await tx.stockBatch.findMany({
        where: {
          warehouseId: warehouse.id,
          id: { in: d.lines.map((l) => l.batchId) },
        },
      });
      if (batches.length !== d.lines.length)
        throw new BadRequestException(
          "Count contains a batch outside this warehouse",
        );
      return tx.stockCount.create({
        data: {
          warehouseId: warehouse.id,
          notes: d.notes,
          number: `SC-${randomUUID().slice(0, 8).toUpperCase()}`,
          createdBy: u.id,
          status: "SUBMITTED",
          lines: {
            create: d.lines.map((l) => ({
              ...l,
              expectedQty: batches.find((b) => b.id === l.batchId)!.qty,
            })),
          },
        },
      });
    });
  }
  async approveCount(u: Actor, id: string, status: string) {
    permit(u, managers);
    return this.db.serial(async (tx) => {
      const count = await tx.stockCount.findFirst({
        where: { id, warehouse: { distributor: distributorScope(u) } },
        include: { warehouse: true, lines: { include: { batch: true } } },
      });
      if (!count) throw new NotFoundException();
      if (
        count.status !== "SUBMITTED" ||
        !["APPROVED", "REJECTED"].includes(status)
      )
        throw new ConflictException("Count has already been reviewed");
      if (status === "APPROVED") {
        let cost = 0;
        for (const l of count.lines) {
          if (l.batch.qty !== l.expectedQty)
            throw new ConflictException(
              "Stock moved after the count. Submit a fresh count.",
            );
          const delta = l.countedQty - l.expectedQty;
          await tx.stockBatch.update({
            where: { id: l.batchId },
            data: { qty: l.countedQty },
          });
          if (l.batch.status === "AVAILABLE") {
            await tx.distributorStock.update({
              where: {
                distributorId_skuId: {
                  distributorId: count.warehouse.distributorId,
                  skuId: l.batch.skuId,
                },
              },
              data: { qty: { increment: delta } },
            });
          }
          await tx.stockMovement.create({
            data: {
              distributorId: count.warehouse.distributorId,
              skuId: l.batch.skuId,
              qty: delta,
              kind: "CYCLE_COUNT",
              reference: count.number,
            },
          });
          cost += delta * l.batch.unitCostMinor;
        }
        if (cost)
          await journal(
            tx,
            u,
            count.warehouse.distributorId,
            count.number,
            "Approved inventory count variance",
            [
              moneyLine("INVENTORY", Math.max(0, cost), Math.max(0, -cost)),
              moneyLine(
                "STOCK_VARIANCE",
                Math.max(0, -cost),
                Math.max(0, cost),
              ),
            ],
          );
      }
      await audit(tx, u, `COUNT_${status}`, id);
      return tx.stockCount.update({
        where: { id },
        data: { status, approvedBy: u.id },
      });
    });
  }
}
