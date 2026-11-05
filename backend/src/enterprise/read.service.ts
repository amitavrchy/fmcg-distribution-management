import { Inject, Injectable } from "@nestjs/common";
import { Db } from "../db";
import {
  Actor,
  managers,
  operators,
  orderScope,
  outletScope,
  distributorScope,
  userScope,
} from "../auth";
import {
  invoiceDue,
  aging,
  abc,
  replenishment,
  JournalLine,
} from "../domain/enterprise";
import { dhakaDate } from "../domain/geo";
@Injectable()
export class EnterpriseRead {
  constructor(@Inject(Db) private db: Db) {}
  async snapshot(u: Actor) {
    const financial = [...operators, "ACCOUNTS"].includes(u.role),
      scope = distributorScope(u),
      distributors = await this.db.distributor.findMany({ where: scope }),
      ids = distributors.map((d) => d.id);
    const [
      warehouses,
      batches,
      suppliers,
      purchases,
      transfers,
      counts,
      returns,
      payables,
      journals,
      expenses,
      handovers,
      vehicles,
      trips,
      tasks,
      opportunities,
      ar,
    ] = await Promise.all([
      this.db.warehouse.findMany({
        where: { distributorId: { in: ids } },
        include: { distributor: true },
        orderBy: { name: "asc" },
      }),
      financial
        ? this.db.stockBatch.findMany({
            where: { warehouse: { distributorId: { in: ids } } },
            include: {
              sku: true,
              warehouse: true,
              allocations: {
                where: { restored: false },
                include: {
                  orderLine: {
                    include: { order: { include: { outlet: true } } },
                  },
                },
              },
            },
            orderBy: [
              { expiresOn: { sort: "asc", nulls: "last" } },
              { receivedAt: "asc" },
            ],
          })
        : Promise.resolve([]),
      financial
        ? this.db.supplier.findMany({ orderBy: { name: "asc" } })
        : Promise.resolve([]),
      financial
        ? this.db.purchaseOrder.findMany({
            where: { distributorId: { in: ids } },
            include: {
              supplier: true,
              distributor: true,
              lines: { include: { sku: true } },
              receipts: { include: { lines: true } },
              payable: { include: { payments: true } },
            },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      financial
        ? this.db.stockTransfer.findMany({
            where: { batch: { warehouse: { distributorId: { in: ids } } } },
            include: { batch: { include: { sku: true, warehouse: true } } },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      financial
        ? this.db.stockCount.findMany({
            where: { warehouse: { distributorId: { in: ids } } },
            include: {
              warehouse: true,
              lines: { include: { batch: { include: { sku: true } } } },
            },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      this.db.returnRequest.findMany({
        where: { order: orderScope(u) },
        include: {
          order: {
            include: {
              outlet: true,
              lines: { include: { sku: true } },
              delivery: { include: { invoice: true } },
            },
          },
          lines: { include: { orderLine: { include: { sku: true } } } },
          credit: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      financial
        ? this.db.supplierPayable.findMany({
            where: { purchase: { distributorId: { in: ids } } },
            include: {
              purchase: { include: { supplier: true } },
              payments: true,
            },
            orderBy: { dueOn: "asc" },
          })
        : Promise.resolve([]),
      financial
        ? this.db.journalEntry.findMany({
            where: { distributorId: { in: ids } },
            orderBy: { createdAt: "desc" },
          })
        : Promise.resolve([]),
      financial
        ? this.db.expense.findMany({
            where: { distributorId: { in: ids } },
            orderBy: { createdAt: "desc" },
          })
        : this.db.expense.findMany({ where: { createdBy: u.id } }),
      this.db.cashHandover.findMany({
        where: financial ? { distributorId: { in: ids } } : { srId: u.id },
        orderBy: { businessDate: "desc" },
      }),
      this.db.vehicle.findMany({
        where: { distributorId: { in: ids } },
        orderBy: { name: "asc" },
      }),
      this.db.deliveryTrip.findMany({
        where: {
          distributorId: { in: ids },
          ...(u.role === "SR" ? { driverId: u.id } : {}),
        },
        include: {
          warehouse: true,
          vehicle: true,
          stops: {
            include: { order: { include: { outlet: true } } },
            orderBy: { sequence: "asc" },
          },
        },
        orderBy: { scheduledOn: "desc" },
      }),
      this.db.fieldTask.findMany({
        where: {
          outlet: outletScope(u),
          ...(u.role === "SR" ? { assignedTo: u.id } : {}),
        },
        include: { outlet: true },
        orderBy: [{ dueOn: "asc" }, { createdAt: "desc" }],
      }),
      this.db.salesOpportunity.findMany({
        where:
          u.role === "COMPANY_ADMIN"
            ? {}
            : u.role === "SR"
              ? { assignedTo: u.id }
              : { territoryId: u.territoryId || "__none" },
        orderBy: { createdAt: "desc" },
      }),
      this.db.invoice.findMany({
        where: {
          outlet: outletScope(u),
          ...(u.role === "SR" ? { delivery: { order: { srId: u.id } } } : {}),
        },
        include: {
          outlet: true,
          delivery: {
            include: { order: { select: { srId: true, distributorId: true } } },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);
    const trial = new Map<
      string,
      {
        account: string;
        debitMinor: number;
        creditMinor: number;
        balanceMinor: number;
      }
    >();
    for (const j of journals)
      for (const l of j.lines as JournalLine[]) {
        const entry = trial.get(l.account) || {
          account: l.account,
          debitMinor: 0,
          creditMinor: 0,
          balanceMinor: 0,
        };
        entry.debitMinor += l.debitMinor;
        entry.creditMinor += l.creditMinor;
        entry.balanceMinor = entry.debitMinor - entry.creditMinor;
        trial.set(l.account, entry);
      }
    const agingRows = ar
      .filter((i) => invoiceDue(i) > 0)
      .map((i) => ({
        id: i.id,
        number: i.number,
        outletId: i.outletId,
        outletName: i.outlet.name,
        outstandingMinor: invoiceDue(i),
        createdAt: i.createdAt,
        ...aging(i.createdAt, i.outlet.paymentTermsDays),
      }));
    const periodStart = new Date(Date.now() - 30 * 86400000),
      sales = await this.db.secondaryOrderLine.findMany({
        where: {
          order: {
            ...orderScope(u),
            status: "DELIVERED",
            delivery: { deliveredAt: { gte: periodStart } },
          },
        },
        include: { sku: true, order: { select: { distributorId: true } } },
      });
    const stock = await this.db.distributorStock.findMany({
      where: { distributorId: { in: ids } },
      include: { sku: true },
    });
    const productAnalytics = abc(
      stock.map((s) => {
        const lines = sales.filter(
            (l) =>
              l.skuId === s.skuId && l.order.distributorId === s.distributorId,
          ),
          sold = lines.reduce((n, l) => n + l.allocatedQty, 0);
        return {
          skuId: s.skuId,
          skuName: s.sku.name,
          distributorId: s.distributorId,
          onHand: s.qty,
          sold,
          valueMinor: lines.reduce(
            (n, l) => n + l.allocatedQty * l.unitPriceMinor,
            0,
          ),
          ...replenishment(sold, 30, s.qty, 7, 5),
        };
      }),
    );
    const expiry = batches
      .filter(
        (b) =>
          b.qty > 0 &&
          b.status === "AVAILABLE" &&
          b.expiresOn &&
          b.expiresOn.getTime() - Date.now() < 30 * 86400000,
      )
      .map((b) => ({
        id: b.id,
        lot: b.lot,
        skuName: b.sku.name,
        warehouseName: b.warehouse.name,
        qty: b.qty,
        daysLeft: Math.ceil((b.expiresOn!.getTime() - Date.now()) / 86400000),
        valueMinor: b.qty * b.unitCostMinor,
      }));
    const today = dhakaDate();
    return {
      warehouses,
      batches,
      suppliers,
      purchases,
      transfers,
      counts,
      returns,
      payables,
      journals: journals.slice(0, 200),
      trialBalance: Array.from(trial.values()).sort((a, b) =>
        a.account.localeCompare(b.account),
      ),
      expenses,
      handovers,
      vehicles,
      trips,
      tasks,
      opportunities,
      aging: agingRows,
      products: productAnalytics,
      expiry,
      summary: {
        inventoryValueMinor:
          batches.reduce(
            (s, b) =>
              s +
              b.qty * b.unitCostMinor +
              b.allocations
                .filter((a) =>
                  ["ALLOCATED", "DISPATCHED"].includes(
                    a.orderLine.order.status,
                  ),
                )
                .reduce((v, a) => v + (a.qty + a.freeQty) * b.unitCostMinor, 0),
            0,
          ) +
          transfers
            .filter((t) => t.status === "IN_TRANSIT")
            .reduce((s, t) => s + t.qty * t.batch.unitCostMinor, 0),
        quarantinedUnits: batches
          .filter((b) => b.status !== "AVAILABLE")
          .reduce((s, b) => s + b.qty, 0),
        openPurchaseCount: purchases.filter((p) =>
          ["DRAFT", "APPROVED", "PARTIAL"].includes(p.status),
        ).length,
        payableMinor: payables.reduce(
          (s, p) => s + p.totalMinor - p.paidMinor,
          0,
        ),
        receivableMinor: agingRows.reduce((s, i) => s + i.outstandingMinor, 0),
        overdueMinor: agingRows
          .filter((i) => i.days > 0)
          .reduce((s, i) => s + i.outstandingMinor, 0),
        pendingRefundMinor: returns.reduce(
          (s, r) =>
            s + (r.credit && !r.credit.refundPaid ? r.credit.refundMinor : 0),
          0,
        ),
        openTasks: tasks.filter((t) => t.status !== "COMPLETED").length,
        lateTasks: tasks.filter(
          (t) => t.status !== "COMPLETED" && t.dueOn < new Date(),
        ).length,
        activeTrips: trips.filter((t) => t.status === "IN_PROGRESS").length,
        pipelineMinor: opportunities
          .filter((o) => !["WON", "LOST"].includes(o.stage))
          .reduce((s, o) => s + o.valueMinor, 0),
      },
      today,
    };
  }
}
