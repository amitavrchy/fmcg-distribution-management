import { Inject, Injectable } from "@nestjs/common";
import { Db } from "./db";
import {
  Actor,
  orderScope,
  outletScope,
  distributorScope,
  userScope,
  permit,
  managers,
} from "./auth";
import { dhakaDate } from "./domain/geo";
import { Cache } from "./cache";
import { Prisma } from "@prisma/client";
@Injectable()
export class ReadService {
  constructor(
    @Inject(Db) private db: Db,
    @Inject(Cache) private cache?: Cache,
  ) {}
  async today(u: Actor) {
    const load = async () => {
      const d = await this.snapshot(u);
      return {
        beats: d.beats,
        outlets: d.outlets,
        visits: d.visits,
        today: d.today,
      };
    };
    return this.cache
      ? this.cache.read(`today-beat:${u.id}:${dhakaDate()}`, load)
      : load();
  }
  async orders(
    u: Actor,
    page: number,
    q: string,
    status: string,
    delivery: boolean,
  ) {
    const where: Prisma.SecondaryOrderWhereInput = {
      ...orderScope(u),
      ...(status !== "ALL" ? { status } : {}),
      ...(delivery ? { delivery: { isNot: null } } : {}),
      ...(q
        ? {
            OR: [
              { number: { contains: q, mode: "insensitive" } },
              { outlet: { name: { contains: q, mode: "insensitive" } } },
              { sr: { fullName: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.db.secondaryOrder.findMany({
        where,
        skip: (page - 1) * 25,
        take: 25,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        include: {
          outlet: true,
          sr: { select: { id: true, fullName: true } },
          lines: { include: { sku: true } },
          delivery: { include: { invoice: true } },
        },
      }),
      this.db.secondaryOrder.count({ where }),
    ]);
    return { rows, total, page, pageSize: 25 };
  }
  async snapshot(u: Actor) {
    const [
      outlets,
      orders,
      stock,
      collections,
      beats,
      distributors,
      skus,
      prices,
      schemes,
      targets,
      visits,
      users,
      territories,
      claims,
      invoices,
      runs,
      movements,
    ] = await Promise.all([
      this.db.outlet.findMany({
        where: outletScope(u),
        include: { beat: true },
        orderBy: { name: "asc" },
      }),
      this.db.secondaryOrder.findMany({
        where: orderScope(u),
        include: {
          outlet: true,
          sr: { select: { id: true, fullName: true } },
          lines: { include: { sku: true } },
          delivery: { include: { invoice: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 500,
      }),
      this.db.distributorStock.findMany({
        where: { distributor: distributorScope(u) },
        include: { sku: true, distributor: true },
      }),
      this.db.collection.findMany({
        where: {
          outlet: outletScope(u),
          ...(u.role === "SR" ? { srId: u.id } : {}),
        },
        include: { outlet: true, sr: { select: { fullName: true } } },
        orderBy: { collectedAt: "desc" },
        take: 500,
      }),
      this.db.beat.findMany({
        where:
          u.role === "COMPANY_ADMIN"
            ? {}
            : { territoryId: u.territoryId || "__none" },
        include: { territory: true },
        orderBy: { name: "asc" },
      }),
      this.db.distributor.findMany({ where: distributorScope(u) }),
      this.db.sku.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
      }),
      this.cache
        ? this.cache.read("active-price-list", () =>
            this.db.priceList.findFirst({
              where: { active: true },
              orderBy: { version: "desc" },
              include: { items: true },
            }),
          )
        : this.db.priceList.findFirst({
            where: { active: true },
            orderBy: { version: "desc" },
            include: { items: true },
          }),
      this.db.scheme.findMany({ orderBy: { priority: "asc" } }),
      this.db.target.findMany({
        where: { sr: userScope(u) },
        include: { sr: { select: { fullName: true } } },
      }),
      this.db.journeyVisit.findMany({
        where: { sr: userScope(u), beatDate: dhakaDate() },
        include: { outlet: true, sr: { select: { fullName: true } } },
      }),
      this.db.user.findMany({
        where: userScope(u),
        select: {
          id: true,
          fullName: true,
          role: true,
          email: true,
          territoryId: true,
          distributorId: true,
          active: true,
        },
      }),
      this.db.territory.findMany({
        where:
          u.role === "COMPANY_ADMIN" ? {} : { id: u.territoryId || "__none" },
        include: { area: { include: { region: true } } },
      }),
      this.db.claim.findMany({
        where: { order: orderScope(u) },
        include: { order: { include: { outlet: true } } },
        orderBy: { createdAt: "desc" },
      }),
      this.db.invoice.findMany({
        where: { outlet: outletScope(u) },
        orderBy: { createdAt: "asc" },
      }),
      u.role === "COMPANY_ADMIN"
        ? this.db.incentiveRun.findMany({ orderBy: { periodYm: "desc" } })
        : Promise.resolve([]),
      this.db.stockMovement.findMany({
        where: {
          distributorId: {
            in: (
              await this.db.distributor.findMany({
                where: distributorScope(u),
                select: { id: true },
              })
            ).map((d) => d.id),
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    const invoiceScope = { delivery: { order: orderScope(u) } };
    const monthStart = new Date(`${dhakaDate().slice(0, 7)}-01T00:00:00+06:00`);
    const [
      allSales,
      monthSales,
      received,
      orderCount,
      pendingCount,
      chartInvoices,
    ] = await Promise.all([
      this.db.invoice.aggregate({
        where: invoiceScope,
        _sum: { totalMinor: true },
      }),
      this.db.invoice.aggregate({
        where: {
          delivery: { order: orderScope(u), deliveredAt: { gte: monthStart } },
        },
        _sum: { totalMinor: true },
      }),
      this.db.collection.aggregate({
        where: {
          outlet: outletScope(u),
          ...(u.role === "SR" ? { srId: u.id } : {}),
          OR: [
            { method: { not: "CHEQUE" }, status: { not: "BOUNCED" } },
            { method: "CHEQUE", status: "RECONCILED" },
          ],
        },
        _sum: { amountMinor: true },
      }),
      this.db.secondaryOrder.count({ where: orderScope(u) }),
      this.db.secondaryOrder.count({
        where: { ...orderScope(u), status: "SUBMITTED" },
      }),
      this.db.invoice.findMany({
        where: {
          delivery: {
            order: orderScope(u),
            deliveredAt: { gte: new Date(Date.now() - 31 * 86400000) },
          },
        },
        select: {
          totalMinor: true,
          delivery: { select: { deliveredAt: true } },
        },
      }),
    ]);
    const [allCredits, monthCredits, chartCredits] = await Promise.all([
      this.db.creditNote.aggregate({
        where: { request: { order: orderScope(u) } },
        _sum: { amountMinor: true },
      }),
      this.db.creditNote.aggregate({
        where: {
          request: { order: orderScope(u) },
          createdAt: { gte: monthStart },
        },
        _sum: { amountMinor: true },
      }),
      this.db.creditNote.findMany({
        where: {
          request: { order: orderScope(u) },
          createdAt: { gte: new Date(Date.now() - 31 * 86400000) },
        },
        select: { amountMinor: true, createdAt: true },
      }),
    ]);
    const series = new Map<string, number>();
    for (const invoice of chartInvoices) {
      if (!invoice.delivery.deliveredAt) continue;
      const day = dhakaDate(invoice.delivery.deliveredAt);
      series.set(day, (series.get(day) || 0) + invoice.totalMinor);
    }
    for (const credit of chartCredits) {
      const day = dhakaDate(credit.createdAt);
      series.set(day, (series.get(day) || 0) - credit.amountMinor);
    }
    return {
      outlets,
      orders,
      stock,
      collections,
      beats,
      distributors,
      skus,
      prices,
      schemes,
      targets,
      visits,
      users,
      territories,
      claims,
      invoices,
      runs,
      movements,
      metrics: {
        salesMinor:
          (allSales._sum.totalMinor || 0) - (allCredits._sum.amountMinor || 0),
        monthlySalesMinor:
          (monthSales._sum.totalMinor || 0) -
          (monthCredits._sum.amountMinor || 0),
        collectedMinor: received._sum.amountMinor || 0,
        orderCount,
        pendingCount,
      },
      salesSeries: Array.from(series, ([day, totalMinor]) => ({
        day,
        totalMinor,
      })),
      historyLimited: orderCount > orders.length,
      serverTime: new Date().toISOString(),
      today: dhakaDate(),
      weekday: new Date().toLocaleDateString("en-US", {
        timeZone: "Asia/Dhaka",
        weekday: "long",
      }),
    };
  }
  audit(u: Actor) {
    permit(u, managers);
    return this.db.auditLog.findMany({
      where:
        u.role === "COMPANY_ADMIN"
          ? {}
          : { actorId: { in: this.dbUserIds(u) } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  }
  private dbUserIds(u: Actor) {
    return [u.id];
  }
}
