import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Db } from "./db";
import { Actor, managers, permit, userScope } from "./auth";
import { parse, minor, text } from "./validation";
import { z } from "zod";
import { calculateIncentive } from "./domain/incentives";
const period = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
@Injectable()
export class IncentivesService {
  constructor(@Inject(Db) private db: Db) {}
  async target(u: Actor, body: unknown) {
    permit(u, managers);
    const d = parse(
      z.object({
        srId: text,
        periodYm: period,
        targetMinor: minor.refine((n) => n > 0),
        focusSkuJson: z.array(text).default([]),
      }),
      body,
    );
    if (
      !(await this.db.user.findFirst({
        where: { id: d.srId, role: "SR", ...userScope(u) },
      }))
    )
      throw new NotFoundException();
    const run = await this.db.incentiveRun.findUnique({
      where: { periodYm: d.periodYm },
    });
    if (run && ["APPROVED", "PAID"].includes(run.status))
      throw new ConflictException("This incentive period is locked");
    return this.db.target.upsert({
      where: { srId_periodYm: { srId: d.srId, periodYm: d.periodYm } },
      create: d,
      update: { targetMinor: d.targetMinor, focusSkuJson: d.focusSkuJson },
    });
  }
  async run(u: Actor, body: unknown) {
    permit(u, ["COMPANY_ADMIN"]);
    const d = parse(z.object({ periodYm: period }), body);
    return this.db.serial(async (tx) => {
      const existing = await tx.incentiveRun.findUnique({
        where: { periodYm: d.periodYm },
      });
      if (existing && ["APPROVED", "PAID"].includes(existing.status))
        throw new ConflictException("Approved runs are locked");
      const targets = await tx.target.findMany({
        where: { periodYm: d.periodYm },
        include: { sr: true },
      });
      const from = new Date(`${d.periodYm}-01T00:00:00+06:00`);
      const [year, month] = d.periodYm.split("-").map(Number);
      const end = new Date(Date.UTC(year, month, 1, -6));
      const results = [];
      for (const t of targets) {
        const orders = await tx.secondaryOrder.findMany({
          where: {
            srId: t.srId,
            status: "DELIVERED",
            delivery: { deliveredAt: { gte: from, lt: end } },
          },
          include: { delivery: { include: { invoice: true } }, lines: true },
        });
        const credits = await tx.creditNote.aggregate({
          where: {
            request: { order: { srId: t.srId } },
            createdAt: { gte: from, lt: end },
          },
          _sum: { amountMinor: true },
        });
        const sales = Math.max(
          0,
          orders.reduce(
            (s, o) => s + (o.delivery?.invoice?.totalMinor || 0),
            0,
          ) - (credits._sum.amountMinor || 0),
        );
        const productive = await tx.journeyVisit.count({
          where: {
            srId: t.srId,
            beatDate: { gte: `${d.periodYm}-01`, lte: `${d.periodYm}-31` },
            callType: { in: ["ORDER", "PRODUCTIVE"] },
          },
        });
        const focusIds = (t.focusSkuJson || []) as string[];
        const focus = orders
          .flatMap((o) => o.lines)
          .filter((l) => focusIds.includes(l.skuId))
          .reduce((s, l) => s + l.allocatedQty * l.unitPriceMinor, 0);
        results.push({
          srId: t.srId,
          fullName: t.sr.fullName,
          salesMinor: sales,
          targetMinor: t.targetMinor,
          ...calculateIncentive(sales, t.targetMinor, productive, focus),
        });
      }
      return tx.incentiveRun.upsert({
        where: { periodYm: d.periodYm },
        create: { periodYm: d.periodYm, results },
        update: { results, status: "CALCULATED" },
      });
    });
  }
  async approve(u: Actor, id: string, status: string) {
    permit(u, ["COMPANY_ADMIN"]);
    const count = await this.db.incentiveRun.updateMany({
      where: { id, status: status === "APPROVED" ? "CALCULATED" : "APPROVED" },
      data: { status },
    });
    if (!["APPROVED", "PAID"].includes(status) || !count.count)
      throw new ConflictException("Invalid incentive transition");
    return { ok: true };
  }
}
