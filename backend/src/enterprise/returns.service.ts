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
import {
  Actor,
  managers,
  operators,
  sellers,
  orderScope,
  permit,
} from "../auth";
import { parse, quantity, text } from "../validation";
import { invoiceDue } from "../domain/enterprise";
import { proportional } from "../domain/money";
import { audit, journal, moneyLine } from "./common";
import { addBatch } from "./warehouse.service";
@Injectable()
export class ReturnsService {
  constructor(@Inject(Db) private db: Db) {}
  async create(u: Actor, body: unknown) {
    permit(u, [...operators, ...sellers]);
    const d = parse(
      z.object({
        clientId: z.uuid(),
        orderId: text,
        reason: z.string().trim().min(10).max(1000),
        lines: z
          .array(
            z
              .object({
                orderLineId: text,
                qty: z.number().int().min(0).max(100000),
                freeQty: z.number().int().min(0).max(100000).default(0),
                disposition: z.enum(["RESTOCK", "QUARANTINE", "SCRAP"]),
              })
              .refine((l) => l.qty + l.freeQty > 0),
          )
          .min(1)
          .max(100),
      }),
      body,
    );
    if (new Set(d.lines.map((l) => l.orderLineId)).size !== d.lines.length)
      throw new BadRequestException("Duplicate return line");
    return this.db.serial(async (tx) => {
      const original = await tx.secondaryOrder.findFirst({
        where: { id: d.orderId, status: "DELIVERED", ...orderScope(u) },
        include: { lines: true },
      });
      if (!original) throw new NotFoundException("Delivered order not found");
      const existing = await tx.returnRequest.findUnique({
        where: { clientId: d.clientId },
      });
      if (existing) {
        if (existing.createdBy !== u.id) throw new ConflictException();
        return existing;
      }
      for (const line of d.lines) {
        const sold = original.lines.find((l) => l.id === line.orderLineId);
        if (!sold)
          throw new BadRequestException(
            "Product does not belong to this order",
          );
        const returned = await tx.returnLine.aggregate({
          where: {
            orderLineId: line.orderLineId,
            request: { status: { not: "REJECTED" } },
          },
          _sum: { qty: true, freeQty: true },
        });
        if (
          line.qty + (returned._sum.qty || 0) > sold.allocatedQty ||
          line.freeQty + (returned._sum.freeQty || 0) > sold.allocatedFreeQty
        )
          throw new ConflictException(
            "Returned units exceed delivered units after existing requests",
          );
      }
      const { lines, ...rest } = d;
      const result = await tx.returnRequest.create({
        data: {
          ...rest,
          number: `RMA-${randomUUID().slice(0, 8).toUpperCase()}`,
          createdBy: u.id,
          lines: { create: lines },
        },
      });
      await audit(tx, u, "RETURN_REQUESTED", result.id);
      return result;
    });
  }
  async review(u: Actor, id: string, status: string) {
    permit(u, managers);
    return this.db.serial(async (tx) => {
      const item = await tx.returnRequest.findFirst({
        where: { id, order: orderScope(u) },
      });
      if (!item) throw new NotFoundException();
      if (
        item.status !== "REQUESTED" ||
        !["APPROVED", "REJECTED"].includes(status)
      )
        throw new ConflictException("This return has already been reviewed");
      await audit(tx, u, `RETURN_${status}`, id);
      return tx.returnRequest.update({
        where: { id },
        data: { status, approvedBy: u.id },
      });
    });
  }
  async receive(u: Actor, id: string, body: unknown) {
    permit(u, operators);
    const d = parse(z.object({ warehouseId: text }), body);
    return this.db.serial(async (tx) => {
      const item = await tx.returnRequest.findFirst({
        where: { id, order: orderScope(u) },
        include: {
          order: {
            include: { lines: true, delivery: { include: { invoice: true } } },
          },
          lines: {
            include: {
              orderLine: {
                include: { batchAllocations: { include: { batch: true } } },
              },
            },
          },
          credit: true,
        },
      });
      if (!item) throw new NotFoundException();
      if (item.credit) return item.credit;
      if (item.status !== "APPROVED")
        throw new ConflictException(
          "Approve the return before receiving goods",
        );
      const warehouse = await tx.warehouse.findFirst({
        where: {
          id: d.warehouseId,
          distributorId: item.order.distributorId,
          active: true,
        },
      });
      if (!warehouse)
        throw new BadRequestException(
          "Choose a warehouse belonging to the order distributor",
        );
      const invoice = item.order.delivery?.invoice;
      if (!invoice) throw new ConflictException("Invoice not found");
      const deliveredGross = item.order.lines.reduce(
        (s, l) => s + l.allocatedQty * l.unitPriceMinor,
        0,
      );
      let gross = 0,
        recoveredCost = 0;
      for (const line of item.lines) {
        const sold = line.orderLine;
        gross += line.qty * sold.unitPriceMinor;
        const allocated = sold.batchAllocations;
        const batchInfo = [...allocated].sort(
          (a, b) =>
            (a.batch.expiresOn?.getTime() || Infinity) -
            (b.batch.expiresOn?.getTime() || Infinity),
        )[0]?.batch;
        const allocatedUnits = allocated.reduce(
          (s, a) => s + a.qty + a.freeQty,
          0,
        );
        const unitCost = allocatedUnits
          ? Math.round(
              allocated.reduce(
                (s, a) => s + (a.qty + a.freeQty) * a.batch.unitCostMinor,
                0,
              ) / allocatedUnits,
            )
          : 0;
        const originBatchIds = Array.from(
          new Set(
            allocated.flatMap((a) => [a.batchId, ...a.batch.originBatchIds]),
          ),
        );
        let disposition = line.disposition;
        if (
          disposition === "RESTOCK" &&
          (allocated.some((a) => a.batch.status === "RECALLED") ||
            (batchInfo?.expiresOn && batchInfo.expiresOn <= new Date()))
        )
          disposition = "QUARANTINE";
        if (disposition !== "SCRAP") {
          const qty = line.qty + line.freeQty;
          await addBatch(tx, {
            warehouseId: warehouse.id,
            skuId: sold.skuId,
            lot: `${item.number}-${sold.id}`,
            qty,
            unitCostMinor: unitCost,
            expiresOn: batchInfo?.expiresOn || null,
            status: disposition === "RESTOCK" ? "AVAILABLE" : "QUARANTINED",
            originBatchIds,
          });
          if (disposition === "RESTOCK")
            await tx.distributorStock.upsert({
              where: {
                distributorId_skuId: {
                  distributorId: item.order.distributorId,
                  skuId: sold.skuId,
                },
              },
              create: {
                distributorId: item.order.distributorId,
                skuId: sold.skuId,
                qty,
              },
              update: { qty: { increment: qty } },
            });
          recoveredCost += qty * unitCost;
          await tx.stockMovement.create({
            data: {
              distributorId: item.order.distributorId,
              skuId: sold.skuId,
              qty,
              kind: `RETURN_${disposition}`,
              reference: item.number,
            },
          });
        }
      }
      const otherCredits = await tx.creditNote.aggregate({
        where: { request: { orderId: item.orderId } },
        _sum: { amountMinor: true },
      });
      const amount = Math.min(
        invoice.totalMinor - (otherCredits._sum.amountMinor || 0),
        proportional(invoice.totalMinor, gross, deliveredGross),
      );
      const pendingCheques = await tx.collection.aggregate({
        where: {
          outletId: invoice.outletId,
          method: "CHEQUE",
          status: "POSTED",
        },
        _sum: { amountMinor: true },
      });
      if (pendingCheques._sum.amountMinor)
        throw new ConflictException(
          "Clear or bounce pending cheques before posting this credit",
        );
      const applied = Math.min(invoiceDue(invoice), amount),
        refund = amount - applied;
      const credit = await tx.creditNote.create({
        data: {
          number: `CN-${randomUUID().slice(0, 8).toUpperCase()}`,
          returnId: id,
          amountMinor: amount,
          appliedMinor: applied,
          refundMinor: refund,
          refundPaid: refund === 0,
        },
      });
      if (applied)
        await tx.invoice.update({
          where: { id: invoice.id },
          data: {
            creditedMinor: { increment: applied },
            status: invoiceDue(invoice) === applied ? "PAID" : "PARTIAL",
          },
        });
      await journal(
        tx,
        u,
        item.order.distributorId,
        credit.number,
        "Sales return credit and refund liability",
        [
          moneyLine("SALES_RETURNS", amount),
          moneyLine("ACCOUNTS_RECEIVABLE", 0, applied),
          moneyLine("REFUNDS_PAYABLE", 0, refund),
        ],
      );
      if (recoveredCost)
        await journal(
          tx,
          u,
          warehouse.distributorId,
          `RECOVER-${credit.id}`,
          "Recovered returned inventory",
          [
            moneyLine("INVENTORY", recoveredCost),
            moneyLine("COST_OF_GOODS", 0, recoveredCost),
          ],
        );
      await tx.returnRequest.update({
        where: { id },
        data: { status: refund ? "RECEIVED" : "SETTLED", receivedBy: u.id },
      });
      await audit(tx, u, "RETURN_RECEIVED", id, {
        amountMinor: amount,
        appliedMinor: applied,
        refundMinor: refund,
      });
      return credit;
    });
  }
  async refund(u: Actor, id: string, body: unknown) {
    permit(u, [...managers, "ACCOUNTS"]);
    const d = parse(
      z.object({
        method: z.enum(["CASH", "BANK", "BKASH", "NAGAD"]),
        reference: text,
      }),
      body,
    );
    return this.db.serial(async (tx) => {
      const credit = await tx.creditNote.findFirst({
        where: { id, request: { order: orderScope(u) } },
        include: { request: { include: { order: true } } },
      });
      if (!credit) throw new NotFoundException();
      if (credit.refundPaid) return credit;
      await journal(
        tx,
        u,
        credit.request.order.distributorId,
        `REFUND-${id}`,
        "Return refund paid",
        [
          moneyLine("REFUNDS_PAYABLE", credit.refundMinor),
          moneyLine(d.method, 0, credit.refundMinor),
        ],
      );
      await tx.returnRequest.update({
        where: { id: credit.returnId },
        data: { status: "SETTLED" },
      });
      await audit(tx, u, "REFUND_PAID", id, {
        method: d.method,
        reference: d.reference,
      });
      return tx.creditNote.update({
        where: { id },
        data: { refundPaid: true, refundReference: d.reference },
      });
    });
  }
}
