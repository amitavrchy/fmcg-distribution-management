import {
  Inject,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import { Queue, Worker } from "bullmq";
import { Db } from "./db";
import { dhakaDate } from "./domain/geo";
import { IncentivesService } from "./incentives.service";
@Injectable()
export class Jobs implements OnModuleInit, OnModuleDestroy {
  private queue?: Queue;
  private worker?: Worker;
  constructor(
    @Inject(Db) private db: Db,
    @Inject(IncentivesService) private incentives: IncentivesService,
  ) {}
  async onModuleInit() {
    if (!process.env.REDIS_URL) return;
    const url = new URL(process.env.REDIS_URL),
      connection = {
        host: url.hostname,
        port: Number(url.port || 6379),
        password: url.password || undefined,
      };
    this.queue = new Queue("distribution-maintenance", { connection });
    this.worker = new Worker(
      "distribution-maintenance",
      async (job) => {
        const today = dhakaDate();
        if (job.name === "monthly-incentives") {
          const [year, month] = today.slice(0, 7).split("-").map(Number);
          const prior = new Date(Date.UTC(year, month - 2, 15));
          const periodYm = prior.toISOString().slice(0, 7);
          const admin = await this.db.user.findFirst({
            where: { role: "COMPANY_ADMIN" },
          });
          const run = await this.db.incentiveRun.findUnique({
            where: { periodYm },
          });
          if (admin && (!run || run.status === "CALCULATED"))
            await this.incentives.run(admin, { periodYm });
          return;
        }
        // Eligibility is evaluated at orderedAt, including delayed offline orders.
        // Do not disable expired schemes: that would erase their historical validity.
        const weekday = new Date().toLocaleDateString("en-US", {
          timeZone: "Asia/Dhaka",
          weekday: "long",
        });
        const day = [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ].indexOf(weekday);
        const srs = await this.db.user.findMany({ where: { role: "SR" } });
        for (const sr of srs) {
          const outlets = await this.db.outlet.findMany({
            where: {
              active: true,
              beat: { territoryId: sr.territoryId || "__none", weekday: day },
            },
          });
          await this.db.journeyVisit.createMany({
            data: outlets.map((o) => ({
              srId: sr.id,
              outletId: o.id,
              beatDate: today,
            })),
            skipDuplicates: true,
          });
        }
        const overdue = await this.db.invoice.findMany({
          where: {
            createdAt: { lt: new Date(Date.now() - 30 * 86400000) },
            status: { not: "PAID" },
          },
        });
        const low = await this.db.distributorStock.findMany({
          include: { sku: true },
        });
        const alerts = [
          ...overdue.map((i) => ({
            action: "CREDIT_OVERDUE_ALERT",
            entityId: i.id,
            details: { amountMinor: i.totalMinor - i.paidMinor },
          })),
          ...low
            .filter((s) => s.qty < s.sku.reorderLevel)
            .map((s) => ({
              action: "LOW_STOCK_ALERT",
              entityId: s.id,
              details: { qty: s.qty },
            })),
        ];
        for (const alert of alerts) {
          if (
            !(await this.db.auditLog.findFirst({
              where: {
                action: alert.action,
                entityId: alert.entityId,
                createdAt: { gte: new Date(`${today}T00:00:00+06:00`) },
              },
            }))
          )
            await this.db.auditLog.create({
              data: { actorId: "SYSTEM", ...alert },
            });
        }
      },
      { connection },
    );
    this.worker.on("error", (e) =>
      console.error("Maintenance worker:", e.message),
    );
    await this.queue.upsertJobScheduler(
      "daily",
      { pattern: "0 0 * * *", tz: "Asia/Dhaka" },
      {
        name: "daily",
        data: {},
        opts: { removeOnComplete: 30, removeOnFail: 50 },
      },
    );
    await this.queue.add("startup", {}, { removeOnComplete: true });
    await this.queue.upsertJobScheduler(
      "monthly-incentives",
      { pattern: "0 2 1 * *", tz: "Asia/Dhaka" },
      {
        name: "monthly-incentives",
        data: {},
        opts: { removeOnComplete: 12, removeOnFail: 12 },
      },
    );
  }
  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }
}
