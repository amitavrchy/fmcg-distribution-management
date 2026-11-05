import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Db } from "./db";
import {
  Actor,
  orderScope,
  outletScope,
  distributorScope,
  permit,
  sellers,
  operators,
  managers,
} from "./auth";
import { orderInput, parse } from "./validation";
import { preview } from "./domain/schemes";
import { exceedsCredit } from "./domain/credit";
import { canTransition } from "./domain/transitions";
import { proportional, safeMinor } from "./domain/money";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { invoiceDue } from "./domain/enterprise";
import {
  ensureBatches,
  reserveBatches,
  restoreBatches,
} from "./enterprise/warehouse.service";
import { journal, moneyLine } from "./enterprise/common";
@Injectable()
export class OrdersService {
  constructor(@Inject(Db) private db: Db) {}
  async create(u: Actor, body: unknown, previewOnly = false) {
    permit(u, sellers);
    const input = parse(orderInput, body);
    const at = new Date(input.orderedAt);
    if (
      at.getTime() > Date.now() + 300000 ||
      at.getTime() < Date.now() - 7 * 86400000
    )
      throw new BadRequestException(
        "Order date must be within the last seven days",
      );
    if (new Set(input.lines.map((l) => l.skuId)).size !== input.lines.length)
      throw new BadRequestException("Combine duplicate SKUs into one line");
    return this.db
      .serial(async (tx) => {
        const existing = await tx.secondaryOrder.findUnique({
          where: { clientOrderId: input.clientOrderId },
        });
        if (existing) {
          if (existing.srId !== u.id) throw new ForbiddenException();
          return existing;
        }
        const outlet = await tx.outlet.findFirst({
          where: { id: input.outletId, active: true, ...outletScope(u) },
          include: { beat: true },
        });
        const distributor = await tx.distributor.findFirst({
          where: { id: input.distributorId, ...distributorScope(u) },
        });
        if (
          !outlet ||
          !distributor ||
          outlet.beat.territoryId !== distributor.territoryId
        )
          throw new BadRequestException(
            "Outlet and distributor must belong to your territory",
          );
        const price = await tx.priceList.findFirst({
          where: { active: true },
          orderBy: { version: "desc" },
          include: { items: true },
        });
        if (!price || price.version !== input.priceListVersion)
          throw new ConflictException(
            "PRICE_STALE: refresh the price list before submitting",
          );
        const skus = await tx.sku.findMany({
          where: { id: { in: input.lines.map((l) => l.skuId) }, active: true },
        });
        if (skus.length !== input.lines.length)
          throw new BadRequestException("One or more products are inactive");
        const cart = input.lines.map((l) => {
          const p = price.items.find((p) => p.skuId === l.skuId);
          if (!p) throw new BadRequestException("Product has no active price");
          return { ...l, unitPriceMinor: p.priceMinor };
        });
        const totals = preview(
          cart,
          await tx.scheme.findMany({ where: { active: true } }),
          at,
        );
        safeMinor(totals.totalMinor);
        safeMinor(totals.goodsMinor);
        if (previewOnly) return totals;
        const invoices = await tx.invoice.findMany({
          where: { outletId: outlet.id },
        });
        const reserved = await tx.secondaryOrder.aggregate({
          where: {
            outletId: outlet.id,
            status: {
              in: ["SUBMITTED", "CONFIRMED", "ALLOCATED", "DISPATCHED"],
            },
          },
          _sum: { totalMinor: true },
        });
        const blocked = exceedsCredit(
          outlet.creditLimitMinor,
          invoices.reduce((s, i) => s + invoiceDue(i), 0),
          reserved._sum.totalMinor || 0,
          totals.totalMinor,
        );
        const order = await tx.secondaryOrder.create({
          data: {
            number: `SO-${randomUUID().slice(0, 8).toUpperCase()}`,
            outletId: outlet.id,
            distributorId: distributor.id,
            srId: u.id,
            clientOrderId: input.clientOrderId,
            priceListVersion: price.version,
            orderedAt: at,
            status: blocked ? "PENDING_APPROVAL" : "SUBMITTED",
            notes: input.notes,
            goodsMinor: totals.goodsMinor,
            discountMinor: totals.discountMinor,
            totalMinor: totals.totalMinor,
            lines: {
              create: cart.map((l) => ({
                ...l,
                freeQty: totals.free[l.skuId] || 0,
              })),
            },
          },
          include: { lines: true },
        });
        await tx.auditLog.create({
          data: {
            actorId: u.id,
            action: "ORDER_CREATED",
            entityId: order.id,
            details: { blocked },
          },
        });
        return order;
      })
      .catch(async (error) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const existing = await this.db.secondaryOrder.findUnique({
            where: { clientOrderId: input.clientOrderId },
          });
          if (existing?.srId === u.id) return existing;
        }
        throw error;
      });
  }
  async transition(u: Actor, id: string, status: string) {
    permit(u, operators);
    return this.db.serial((tx) =>
      this.transitionInTransaction(u, id, status, tx),
    );
  }
  async transitionInTransaction(
    u: Actor,
    id: string,
    status: string,
    tx: Prisma.TransactionClient,
    scope: Prisma.SecondaryOrderWhereInput = orderScope(u),
  ) {
    const order = await tx.secondaryOrder.findFirst({
      where: { id, ...scope },
      include: { lines: true, outlet: true },
    });
    if (!order) throw new NotFoundException();
    if (!canTransition(order.status, status))
      throw new ConflictException(`Cannot change ${order.status} to ${status}`);
    const update: Prisma.SecondaryOrderUpdateInput = { status };
    if (status === "CONFIRMED") {
      const invoices = await tx.invoice.findMany({
        where: { outletId: order.outletId },
      });
      const reserved = await tx.secondaryOrder.aggregate({
        where: {
          id: { not: id },
          outletId: order.outletId,
          status: { in: ["CONFIRMED", "ALLOCATED", "DISPATCHED"] },
        },
        _sum: { totalMinor: true },
      });
      const blocked = exceedsCredit(
        order.outlet.creditLimitMinor,
        invoices.reduce((s, i) => s + invoiceDue(i), 0),
        reserved._sum.totalMinor || 0,
        order.totalMinor,
      );
      if (blocked) {
        permit(u, managers);
        update.creditApproved = true;
      }
    }
    if (status === "ALLOCATED") {
      const schemes = await tx.scheme.findMany({ where: { active: true } });
      let partial = false,
        any = false;
      for (const line of order.lines) {
        await ensureBatches(tx, order.distributorId, line.skuId);
        const sellable = await tx.stockBatch.aggregate({
          where: {
            skuId: line.skuId,
            status: "AVAILABLE",
            warehouse: { distributorId: order.distributorId, active: true },
            OR: [{ expiresOn: null }, { expiresOn: { gt: new Date() } }],
          },
          _sum: { qty: true },
        });
        const stock = await tx.distributorStock.findUnique({
          where: {
            distributorId_skuId: {
              distributorId: order.distributorId,
              skuId: line.skuId,
            },
          },
        });
        const available = Math.min(stock?.qty || 0, sellable._sum.qty || 0);
        const qty = Math.min(available, line.qty),
          free = Math.min(
            Math.max(0, available - qty),
            Math.min(
              line.freeQty,
              preview(
                [
                  {
                    skuId: line.skuId,
                    qty,
                    unitPriceMinor: line.unitPriceMinor,
                  },
                ],
                schemes,
                order.orderedAt,
              ).free[line.skuId] || 0,
            ),
          );
        if (qty < line.qty || free < line.freeQty) partial = true;
        if (qty > 0) any = true;
        if (qty + free > 0) {
          await reserveBatches(
            tx,
            order.distributorId,
            line.id,
            line.skuId,
            qty,
            free,
          );
          await tx.distributorStock.update({
            where: { id: stock!.id },
            data: { qty: { decrement: qty + free } },
          });
          await tx.stockMovement.create({
            data: {
              distributorId: order.distributorId,
              skuId: line.skuId,
              qty: -(qty + free),
              kind: "ALLOCATION",
              reference: order.number,
            },
          });
        }
        await tx.secondaryOrderLine.update({
          where: { id: line.id },
          data: { allocatedQty: qty, allocatedFreeQty: free },
        });
      }
      if (!any) throw new ConflictException("No stock available to allocate");
      update.backorder = partial;
      await tx.delivery.create({ data: { orderId: id } });
    }
    if (status === "CANCELLED" && order.status === "ALLOCATED") {
      for (const l of order.lines) {
        const restored = await restoreBatches(tx, order.distributorId, l);
        await tx.distributorStock.update({
          where: {
            distributorId_skuId: {
              distributorId: order.distributorId,
              skuId: l.skuId,
            },
          },
          data: { qty: { increment: restored } },
        });
        await tx.stockMovement.create({
          data: {
            distributorId: order.distributorId,
            skuId: l.skuId,
            qty: l.allocatedQty + l.allocatedFreeQty,
            kind: "CANCELLATION",
            reference: order.number,
          },
        });
      }
      await tx.delivery.update({
        where: { orderId: id },
        data: { status: "FAILED" },
      });
    }
    if (["DISPATCHED", "DELIVERED"].includes(status)) {
      const blocked = await tx.batchAllocation.findFirst({
        where: {
          orderLine: { orderId: id },
          restored: false,
          batch: {
            OR: [
              { status: { not: "AVAILABLE" } },
              { expiresOn: { lte: new Date() } },
            ],
          },
        },
      });
      if (blocked)
        throw new ConflictException(
          "Allocated batch is expired, quarantined or recalled. Resolve its disposition before shipping.",
        );
    }
    if (status === "DELIVERED") {
      const goods = order.lines.reduce(
        (s, l) => s + l.allocatedQty * l.unitPriceMinor,
        0,
      );
      const total =
        goods - proportional(order.discountMinor, goods, order.goodsMinor);
      const delivery = await tx.delivery.update({
        where: { orderId: id },
        data: {
          status: order.backorder ? "PARTIAL" : "DONE",
          deliveredAt: new Date(),
        },
      });
      await tx.invoice.create({
        data: {
          number: `INV-${order.number.slice(3)}`,
          deliveryId: delivery.id,
          outletId: order.outletId,
          totalMinor: total,
        },
      });
      await journal(
        tx,
        u,
        order.distributorId,
        `SALE-${order.id}`,
        `Sales invoice ${order.number}`,
        [moneyLine("ACCOUNTS_RECEIVABLE", total), moneyLine("SALES", 0, total)],
      );
      const allocations = await tx.batchAllocation.findMany({
        where: { orderLine: { orderId: id }, restored: false },
        include: { batch: true },
      });
      const cost = allocations.reduce(
        (s, a) => s + (a.qty + a.freeQty) * a.batch.unitCostMinor,
        0,
      );
      if (cost)
        await journal(
          tx,
          u,
          order.distributorId,
          `COGS-${id}`,
          "Delivered inventory cost",
          [moneyLine("COST_OF_GOODS", cost), moneyLine("INVENTORY", 0, cost)],
        );
    }
    const result = await tx.secondaryOrder.update({
      where: { id },
      data: update,
    });
    await tx.auditLog.create({
      data: {
        actorId: u.id,
        action: `ORDER_${status}`,
        entityId: id,
        details: { from: order.status },
      },
    });
    return result;
  }
}
