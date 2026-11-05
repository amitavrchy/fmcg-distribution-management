import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Actor, distributorScope } from "../auth";
import { balanced, JournalLine } from "../domain/enterprise";
export type Tx = Prisma.TransactionClient;
export async function checkDistributor(tx: Tx, u: Actor, id: string) {
  const d = await tx.distributor.findFirst({
    where: { id, ...distributorScope(u) },
  });
  if (!d)
    throw new NotFoundException("Distribution partner is outside your scope");
  return d;
}
export async function audit(
  tx: Tx,
  u: Actor,
  action: string,
  entityId: string,
  details: Prisma.InputJsonValue = {},
) {
  await tx.auditLog.create({
    data: { actorId: u.id, action, entityId, details },
  });
}
export async function journal(
  tx: Tx,
  u: Actor,
  distributorId: string,
  reference: string,
  description: string,
  lines: JournalLine[],
) {
  const meaningful = lines.filter((l) => l.debitMinor || l.creditMinor);
  if (!meaningful.length) return;
  if (!balanced(meaningful))
    throw new ForbiddenException("Journal entry must balance");
  return tx.journalEntry.upsert({
    where: { reference },
    create: {
      reference,
      description,
      distributorId,
      createdBy: u.id,
      lines: meaningful,
    },
    update: {},
  });
}
export const moneyLine = (
  account: string,
  debitMinor = 0,
  creditMinor = 0,
): JournalLine => ({ account, debitMinor, creditMinor });
