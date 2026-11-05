import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { Db } from "../db";
import { Actor, managers, operators, permit, distributorScope } from "../auth";
import { parse, minor, quantity, text } from "../validation";
import { safeMinor } from "../domain/money";
import { audit, checkDistributor, journal, moneyLine } from "./common";
import { addBatch } from "./warehouse.service";
@Injectable()
export class ProcurementService {
  constructor(@Inject(Db) private db: Db) {}
  async supplier(u: Actor, body: unknown) {
    permit(u, managers);
    const d = parse(
      z.object({
        name: text,
        code: text,
        contact: text,
        phone: z.string().min(5).max(30),
        email: z.union([z.email(), z.literal("")]).optional(),
        paymentTermsDays: z.number().int().min(0).max(365),
      }),
      body,
    );
    return this.db.supplier.create({ data: { ...d, email: d.email || null } });
  }
  async create(u: Actor, body: unknown) {
    permit(u, operators);
    const d = parse(
      z.object({
        clientId: z.uuid(),
        supplierId: text,
        distributorId: text,
        expectedOn: z.iso.datetime(),
        freightMinor: minor.default(0),
        taxBps: z.number().int().min(0).max(10000).default(0),
        notes: z.string().max(500).default(""),
        lines: z
          .array(
            z.object({
              skuId: text,
              qty: quantity,
              unitCostMinor: minor.refine((n) => n > 0),
            }),
          )
          .min(1)
          .max(100),
      }),
      body,
    );
    if (new Set(d.lines.map((l) => l.skuId)).size !== d.lines.length)
      throw new BadRequestException("Combine duplicate product lines");
    safeMinor(
      d.lines.reduce((s, l) => s + l.qty * l.unitCostMinor, 0) + d.freightMinor,
    );
    return this.db.serial(async (tx) => {
      await checkDistributor(tx, u, d.distributorId);
      const existing = await tx.purchaseOrder.findUnique({
        where: { clientId: d.clientId },
      });
      if (existing) {
        if (existing.createdBy !== u.id) throw new ConflictException();
        return existing;
      }
      if (
        !(await tx.supplier.findFirst({
          where: { id: d.supplierId, active: true },
        }))
      )
        throw new NotFoundException("Supplier is inactive or missing");
      const { lines, ...rest } = d;
      const result = await tx.purchaseOrder.create({
        data: {
          ...rest,
          number: `PO-${randomUUID().slice(0, 8).toUpperCase()}`,
          createdBy: u.id,
          lines: { create: lines },
        },
      });
      await audit(tx, u, "PURCHASE_CREATED", result.id);
      return result;
    });
  }
  async approve(u: Actor, id: string, status: string) {
    permit(u, managers);
    return this.db.serial(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id, distributor: distributorScope(u) },
      });
      if (!po) throw new NotFoundException();
      if (!(
        (po.status === "DRAFT" && status === "APPROVED") ||
        (["DRAFT", "APPROVED"].includes(po.status) && status === "CANCELLED")
      ))
        throw new ConflictException("Invalid purchase order transition");
      if (
        status === "APPROVED" &&
        po.createdBy === u.id &&
        u.role !== "COMPANY_ADMIN"
      )
        throw new ConflictException(
          "A different manager must approve this purchase",
        );
      await audit(tx, u, `PURCHASE_${status}`, id, {
        administratorOverride: po.createdBy === u.id,
      });
      return tx.purchaseOrder.update({
        where: { id },
        data: { status, approvedBy: u.id },
      });
    });
  }
  async receive(u: Actor, id: string, body: unknown) {
    permit(u, operators);
    const d = parse(
      z.object({
        clientId: z.uuid(),
        warehouseId: text,
        lines: z
          .array(
            z.object({
              purchaseLineId: text,
              qty: quantity,
              lot: text,
              expiresOn: z.iso.datetime().nullable(),
            }),
          )
          .min(1)
          .max(100),
      }),
      body,
    );
    if (new Set(d.lines.map((l) => l.purchaseLineId)).size !== d.lines.length)
      throw new BadRequestException("Use one receipt line per purchase line");
    return this.db.serial(async (tx) => {
      const existing = await tx.goodsReceipt.findUnique({
        where: { clientId: d.clientId },
      });
      if (existing) {
        const po = await tx.purchaseOrder.findFirst({
          where: { id: existing.purchaseId, distributor: distributorScope(u) },
        });
        if (!po) throw new NotFoundException();
        return existing;
      }
      const po = await tx.purchaseOrder.findFirst({
        where: { id, distributor: distributorScope(u) },
        include: { lines: true, supplier: true },
      });
      if (!po) throw new NotFoundException();
      if (!["APPROVED", "PARTIAL"].includes(po.status))
        throw new ConflictException(
          "Approve this purchase before receiving goods",
        );
      const warehouse = await tx.warehouse.findFirst({
        where: {
          id: d.warehouseId,
          distributorId: po.distributorId,
          active: true,
        },
      });
      if (!warehouse)
        throw new BadRequestException(
          "Warehouse does not belong to this purchase",
        );
      const grn = await tx.goodsReceipt.create({
        data: {
          number: `GRN-${randomUUID().slice(0, 8).toUpperCase()}`,
          clientId: d.clientId,
          purchaseId: id,
          receivedBy: u.id,
        },
      });
      const orderedUnits = po.lines.reduce((s, l) => s + l.qty, 0);
      let receivedUnits = po.lines.reduce((s, l) => s + l.receivedQty, 0),
        freightRoundingMinor = 0;
      let inventoryMinor = 0,
        taxMinor = 0;
      for (const line of d.lines) {
        const original = po.lines.find((l) => l.id === line.purchaseLineId);
        if (!original || line.qty > original.qty - original.receivedQty)
          throw new ConflictException(
            "Receipt exceeds the open purchase quantity",
          );
        if (line.expiresOn && new Date(line.expiresOn) <= new Date())
          throw new BadRequestException(
            "Cannot receive expired goods as available inventory",
          );
        const landedUnit =
            original.unitCostMinor + Math.floor(po.freightMinor / orderedUnits),
          cost = line.qty * landedUnit,
          tax = Math.floor(
            (line.qty * original.unitCostMinor * po.taxBps) / 10000,
          );
        inventoryMinor += cost;
        const freightShare =
          Math.floor(
            (po.freightMinor * (receivedUnits + line.qty)) / orderedUnits,
          ) - Math.floor((po.freightMinor * receivedUnits) / orderedUnits);
        const rounding =
          freightShare - line.qty * Math.floor(po.freightMinor / orderedUnits);
        receivedUnits += line.qty;
        freightRoundingMinor += rounding;
        taxMinor += tax;
        const batch = await addBatch(tx, {
          warehouseId: warehouse.id,
          skuId: original.skuId,
          lot: line.lot,
          qty: line.qty,
          unitCostMinor: landedUnit,
          expiresOn: line.expiresOn ? new Date(line.expiresOn) : null,
        });
        await tx.goodsReceiptLine.create({
          data: {
            receiptId: grn.id,
            purchaseLineId: original.id,
            qty: line.qty,
            batchId: batch.id,
            costMinor: cost + tax + rounding,
          },
        });
        await tx.purchaseOrderLine.update({
          where: { id: original.id },
          data: { receivedQty: { increment: line.qty } },
        });
        await tx.distributorStock.upsert({
          where: {
            distributorId_skuId: {
              distributorId: po.distributorId,
              skuId: original.skuId,
            },
          },
          create: {
            distributorId: po.distributorId,
            skuId: original.skuId,
            qty: line.qty,
          },
          update: { qty: { increment: line.qty } },
        });
        await tx.stockMovement.create({
          data: {
            distributorId: po.distributorId,
            skuId: original.skuId,
            qty: line.qty,
            kind: "PURCHASE_RECEIPT",
            reference: grn.number,
          },
        });
      }
      const received = await tx.purchaseOrderLine.findMany({
        where: { purchaseId: id },
      });
      await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: received.every((l) => l.receivedQty === l.qty)
            ? "RECEIVED"
            : "PARTIAL",
        },
      });
      const total = safeMinor(inventoryMinor + taxMinor + freightRoundingMinor),
        dueOn = new Date(Date.now() + po.supplier.paymentTermsDays * 86400000);
      await tx.supplierPayable.upsert({
        where: { purchaseId: id },
        create: { purchaseId: id, totalMinor: total, dueOn },
        update: { totalMinor: { increment: total } },
      });
      await journal(
        tx,
        u,
        po.distributorId,
        grn.number,
        "Purchase receipt and landed cost",
        [
          moneyLine("INVENTORY", inventoryMinor),
          moneyLine("LANDED_COST_ROUNDING", freightRoundingMinor),
          moneyLine("PURCHASE_TAX", taxMinor),
          moneyLine("ACCOUNTS_PAYABLE", 0, total),
        ],
      );
      await audit(tx, u, "GOODS_RECEIVED", grn.id, {
        purchaseId: id,
        totalMinor: total,
      });
      return grn;
    });
  }
  async pay(u: Actor, id: string, body: unknown) {
    permit(u, [...managers, "ACCOUNTS"]);
    const d = parse(
      z.object({
        clientId: z.uuid(),
        amountMinor: minor.refine((n) => n > 0),
        method: z.enum(["BANK", "CASH", "BKASH", "NAGAD"]),
        reference: text,
      }),
      body,
    );
    return this.db.serial(async (tx) => {
      const payable = await tx.supplierPayable.findFirst({
        where: { id, purchase: { distributor: distributorScope(u) } },
        include: { purchase: true },
      });
      if (!payable) throw new NotFoundException();
      const existing = await tx.supplierPayment.findUnique({
        where: { clientId: d.clientId },
      });
      if (existing) {
        if (existing.payableId !== id) throw new ConflictException();
        return existing;
      }
      if (d.amountMinor > payable.totalMinor - payable.paidMinor)
        throw new ConflictException("Payment exceeds the supplier balance");
      const p = await tx.supplierPayment.create({
        data: { ...d, payableId: id, createdBy: u.id },
      });
      await tx.supplierPayable.update({
        where: { id },
        data: { paidMinor: { increment: d.amountMinor } },
      });
      await journal(
        tx,
        u,
        payable.purchase.distributorId,
        `SUP-PAY-${p.id}`,
        "Supplier payment",
        [
          moneyLine("ACCOUNTS_PAYABLE", d.amountMinor),
          moneyLine(d.method, 0, d.amountMinor),
        ],
      );
      return p;
    });
  }
}
