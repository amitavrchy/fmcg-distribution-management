import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Db } from "./db";
import { Actor, collectors, managers, outletScope, permit } from "./auth";
import { collectionInput, parse } from "./validation";
import { fifo } from "./domain/fifo";
import { Prisma } from "@prisma/client";
import { invoiceDue } from "./domain/enterprise";
import { journal, moneyLine } from "./enterprise/common";
import { dhakaDate } from "./domain/geo";
@Injectable()
export class CollectionsService {
  constructor(@Inject(Db) private db: Db) {}
  async postJournal(
    tx: Prisma.TransactionClient,
    u: Actor,
    id: string,
    method: string,
  ) {
    const allocations = await tx.collectionAllocation.findMany({
      where: { collectionId: id },
      include: {
        invoice: {
          include: {
            delivery: {
              include: { order: { select: { distributorId: true } } },
            },
          },
        },
      },
    });
    const grouped = new Map<string, number>();
    for (const a of allocations) {
      const distributorId = a.invoice.delivery.order.distributorId;
      grouped.set(
        distributorId,
        (grouped.get(distributorId) || 0) + a.amountMinor,
      );
    }
    for (const [distributorId, amount] of grouped)
      await journal(
        tx,
        u,
        distributorId,
        `COL-${id}-${distributorId}`,
        "Allocated customer collection",
        [
          moneyLine(
            method === "CASH"
              ? "FIELD_CASH"
              : method === "CHEQUE"
                ? "BANK"
                : method,
            amount,
          ),
          moneyLine("ACCOUNTS_RECEIVABLE", 0, amount),
        ],
      );
  }
  async allocate(
    tx: Prisma.TransactionClient,
    id: string,
    outletId: string,
    amount: number,
  ) {
    const invoices = await tx.invoice.findMany({
      where: { outletId, status: { not: "PAID" } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const result = fifo(amount, invoices);
    if (result.remaining)
      throw new BadRequestException(
        "Collection cannot exceed outstanding invoices",
      );
    for (const a of result.allocations) {
      const invoice = invoices.find((i) => i.id === a.invoiceId)!;
      await tx.collectionAllocation.create({
        data: { collectionId: id, ...a },
      });
      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          paidMinor: { increment: a.amountMinor },
          status:
            invoice.paidMinor + invoice.creditedMinor + a.amountMinor ===
            invoice.totalMinor
              ? "PAID"
              : "PARTIAL",
        },
      });
    }
  }
  async create(u: Actor, body: unknown) {
    permit(u, collectors);
    const input = parse(collectionInput, body);
    const collectedAt = input.collectedAt
      ? new Date(input.collectedAt)
      : new Date();
    if (
      collectedAt.getTime() > Date.now() + 300000 ||
      collectedAt.getTime() < Date.now() - 7 * 86400000
    )
      throw new BadRequestException(
        "Collection timestamp must be within the last seven days",
      );
    return this.db
      .serial(async (tx) => {
        const existing = await tx.collection.findUnique({
          where: { clientCollectionId: input.clientCollectionId },
        });
        if (existing) {
          if (existing.srId !== u.id)
            throw new ConflictException("Client key already used");
          return existing;
        }
        if (
          !(await tx.outlet.findFirst({
            where: { id: input.outletId, ...outletScope(u) },
          }))
        )
          throw new NotFoundException();
        const invoices = await tx.invoice.findMany({
          where: { outletId: input.outletId },
        });
        const pending = await tx.collection.aggregate({
          where: {
            outletId: input.outletId,
            method: "CHEQUE",
            status: "POSTED",
          },
          _sum: { amountMinor: true },
        });
        const due =
          invoices.reduce((s, i) => s + invoiceDue(i), 0) -
          (pending._sum.amountMinor || 0);
        if (input.amountMinor > due)
          throw new BadRequestException(
            "Amount exceeds unreserved outstanding balance",
          );
        const item = await tx.collection.create({
          data: { ...input, srId: u.id, collectedAt },
        });
        if (input.method !== "CHEQUE")
          await this.allocate(tx, item.id, input.outletId, input.amountMinor);
        if (input.method !== "CHEQUE") {
          if (input.method === "CASH") {
            const allocations = await tx.collectionAllocation.findMany({
              where: { collectionId: item.id },
              include: {
                invoice: {
                  include: {
                    delivery: {
                      select: { order: { select: { distributorId: true } } },
                    },
                  },
                },
              },
            });
            const partners = Array.from(
              new Set(
                allocations.map((a) => a.invoice.delivery.order.distributorId),
              ),
            );
            if (
              await tx.cashHandover.findFirst({
                where: {
                  srId: u.id,
                  distributorId: { in: partners },
                  businessDate: dhakaDate(collectedAt),
                },
              })
            )
              throw new ConflictException(
                "This cash day has already been handed over. Ask accounts to review the late collection.",
              );
          }
          await this.postJournal(tx, u, item.id, input.method);
        }
        await tx.auditLog.create({
          data: {
            actorId: u.id,
            action: "COLLECTION_POSTED",
            entityId: item.id,
            details: { method: item.method },
          },
        });
        return item;
      })
      .catch(async (error) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          const existing = await this.db.collection.findUnique({
            where: { clientCollectionId: input.clientCollectionId },
          });
          if (existing?.srId === u.id) return existing;
        }
        throw error;
      });
  }
  async reconcile(u: Actor, id: string, status: string) {
    permit(u, [...managers, "ACCOUNTS"]);
    return this.db.serial(async (tx) => {
      const item = await tx.collection.findFirst({
        where: { id, outlet: outletScope(u) },
        include: { allocations: true },
      });
      if (!item) throw new NotFoundException();
      if (item.status !== "POSTED")
        throw new ConflictException("Collection has already been reconciled");
      if (
        !["RECONCILED", "BOUNCED"].includes(status) ||
        (status === "BOUNCED" && item.method !== "CHEQUE")
      )
        throw new BadRequestException("Invalid collection transition");
      if (status === "RECONCILED" && item.method === "CHEQUE")
        await this.allocate(tx, id, item.outletId, item.amountMinor);
      if (status === "RECONCILED" && item.method === "CHEQUE") {
        await this.postJournal(tx, u, id, item.method);
      }
      await tx.auditLog.create({
        data: {
          actorId: u.id,
          action: `COLLECTION_${status}`,
          entityId: id,
          details: {},
        },
      });
      return tx.collection.update({ where: { id }, data: { status } });
    });
  }
}
