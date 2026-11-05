import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import { Db } from "../db";
import {
  Actor,
  managers,
  operators,
  sellers,
  permit,
  distributorScope,
  userScope,
} from "../auth";
import { parse, minor, text } from "../validation";
import { dhakaDate } from "../domain/geo";
import { audit, checkDistributor, journal, moneyLine } from "./common";
@Injectable()
export class FinanceService {
  constructor(@Inject(Db) private db: Db) {}
  async expense(u: Actor, body: unknown) {
    permit(u, [...operators, ...sellers, "ACCOUNTS"]);
    const d = parse(
      z.object({
        distributorId: text,
        category: z.enum([
          "FUEL",
          "TRAVEL",
          "WAREHOUSE",
          "UTILITIES",
          "MARKETING",
          "OTHER",
        ]),
        amountMinor: minor.refine((n) => n > 0),
        description: z.string().trim().min(10).max(500),
        receiptReference: text,
      }),
      body,
    );
    return this.db.serial(async (tx) => {
      await checkDistributor(tx, u, d.distributorId);
      return tx.expense.create({ data: { ...d, createdBy: u.id } });
    });
  }
  async reviewExpense(u: Actor, id: string, status: string) {
    permit(u, managers);
    return this.db.serial(async (tx) => {
      const expense = await tx.expense.findUnique({ where: { id } });
      if (!expense) throw new NotFoundException();
      await checkDistributor(tx, u, expense.distributorId);
      if (
        expense.status !== "SUBMITTED" ||
        !["APPROVED", "REJECTED"].includes(status)
      )
        throw new ConflictException("Expense has already been reviewed");
      if (expense.createdBy === u.id && u.role !== "COMPANY_ADMIN")
        throw new ConflictException(
          "A different manager must approve this expense",
        );
      if (status === "APPROVED")
        await journal(
          tx,
          u,
          expense.distributorId,
          `EXP-${id}`,
          expense.description,
          [
            moneyLine(`EXPENSE_${expense.category}`, expense.amountMinor),
            moneyLine("EXPENSES_PAYABLE", 0, expense.amountMinor),
          ],
        );
      await audit(tx, u, `EXPENSE_${status}`, id);
      return tx.expense.update({
        where: { id },
        data: { status, approvedBy: u.id },
      });
    });
  }
  async payExpense(u: Actor, id: string, body: unknown) {
    permit(u, [...managers, "ACCOUNTS"]);
    const d = parse(
      z.object({
        method: z.enum(["CASH", "BANK", "BKASH", "NAGAD"]),
        reference: text,
      }),
      body,
    );
    return this.db.serial(async (tx) => {
      const expense = await tx.expense.findUnique({ where: { id } });
      if (!expense) throw new NotFoundException();
      await checkDistributor(tx, u, expense.distributorId);
      if (expense.status !== "APPROVED")
        throw new ConflictException(
          "Only approved, unpaid expenses can be paid",
        );
      await journal(
        tx,
        u,
        expense.distributorId,
        `EXP-PAY-${id}`,
        `Expense payment ${d.reference}`,
        [
          moneyLine("EXPENSES_PAYABLE", expense.amountMinor),
          moneyLine(d.method, 0, expense.amountMinor),
        ],
      );
      return tx.expense.update({ where: { id }, data: { status: "PAID" } });
    });
  }
  async handover(u: Actor, body: unknown) {
    permit(u, sellers);
    const d = parse(
      z.object({
        distributorId: text,
        businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        declaredMinor: minor,
        discrepancyReason: z.string().max(500).default(""),
      }),
      body,
    );
    if (d.businessDate > dhakaDate())
      throw new BadRequestException("Future cash handovers are not allowed");
    return this.db.serial(async (tx) => {
      await checkDistributor(tx, u, d.distributorId);
      const existing = await tx.cashHandover.findUnique({
        where: {
          srId_distributorId_businessDate: {
            srId: u.id,
            distributorId: d.distributorId,
            businessDate: d.businessDate,
          },
        },
      });
      if (existing)
        throw new ConflictException(
          "This day already has a submitted handover",
        );
      const from = new Date(`${d.businessDate}T00:00:00+06:00`),
        to = new Date(from.getTime() + 86400000);
      const cash = await tx.collectionAllocation.aggregate({
        where: {
          invoice: { delivery: { order: { distributorId: d.distributorId } } },
          collection: {
            srId: u.id,
            method: "CASH",
            status: { not: "BOUNCED" },
            collectedAt: { gte: from, lt: to },
          },
        },
        _sum: { amountMinor: true },
      });
      const expectedMinor = cash._sum.amountMinor || 0;
      if (
        expectedMinor !== d.declaredMinor &&
        d.discrepancyReason.trim().length < 10
      )
        throw new BadRequestException(
          "Explain the cash variance in at least 10 characters",
        );
      return tx.cashHandover.create({
        data: { ...d, srId: u.id, expectedMinor },
      });
    });
  }
  async acceptHandover(u: Actor, id: string) {
    permit(u, [...managers, "ACCOUNTS"]);
    return this.db.serial(async (tx) => {
      const item = await tx.cashHandover.findUnique({ where: { id } });
      if (!item) throw new NotFoundException();
      await checkDistributor(tx, u, item.distributorId);
      if (item.status !== "SUBMITTED")
        throw new ConflictException("Handover already received");
      const delta = item.declaredMinor - item.expectedMinor;
      await journal(
        tx,
        u,
        item.distributorId,
        `HANDOVER-${id}`,
        "SR cash settlement",
        [
          moneyLine("CASH", item.declaredMinor),
          moneyLine("CASH_VARIANCE", Math.max(0, -delta), Math.max(0, delta)),
          moneyLine("FIELD_CASH", 0, item.expectedMinor),
        ],
      );
      await audit(tx, u, "CASH_HANDOVER_RECEIVED", id, {
        varianceMinor: delta,
      });
      return tx.cashHandover.update({
        where: { id },
        data: { status: "RECEIVED", receivedBy: u.id },
      });
    });
  }
}
