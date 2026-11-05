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
@Injectable()
export class CollectionsService {
  constructor(@Inject(Db) private db: Db) {}
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
            invoice.paidMinor + a.amountMinor === invoice.totalMinor
              ? "PAID"
              : "PARTIAL",
        },
      });
    }
  }
  async create(u: Actor, body: unknown) {
    permit(u, collectors);
    const input = parse(collectionInput, body);
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
          invoices.reduce((s, i) => s + i.totalMinor - i.paidMinor, 0) -
          (pending._sum.amountMinor || 0);
        if (input.amountMinor > due)
          throw new BadRequestException(
            "Amount exceeds unreserved outstanding balance",
          );
        const item = await tx.collection.create({
          data: { ...input, srId: u.id },
        });
        if (input.method !== "CHEQUE")
          await this.allocate(tx, item.id, input.outletId, input.amountMinor);
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
