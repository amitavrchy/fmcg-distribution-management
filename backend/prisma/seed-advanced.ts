import "dotenv/config";
import { createHash } from "node:crypto";
import { Db } from "../src/db";
import {
  WarehouseService,
  defaultWarehouse,
} from "../src/enterprise/warehouse.service";
import { ProcurementService } from "../src/enterprise/procurement.service";
import { ReturnsService } from "../src/enterprise/returns.service";
import { FieldService } from "../src/enterprise/field.service";
import { OrdersService } from "../src/orders.service";
import { journal, moneyLine } from "../src/enterprise/common";
const db = new Db();
const uuid = (key: string) => {
  const h = createHash("sha256")
    .update(`deshflow-advanced-demo:${key}`)
    .digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
async function seed() {
  const admin = await db.user.findUniqueOrThrow({
      where: { email: "admin@fmcg.local" },
    }),
    sr = await db.user.findUniqueOrThrow({ where: { email: "sr@fmcg.local" } }),
    distributor = await db.distributor.findUniqueOrThrow({
      where: { code: "DST-001" },
    });
  const warehouseService = new WarehouseService(db),
    procure = new ProcurementService(db),
    returns = new ReturnsService(db),
    field = new FieldService(db, new OrdersService(db));
  await warehouseService.bootstrap(admin);
  const main = await db.serial((tx) => defaultWarehouse(tx, distributor.id));
  await db.warehouse.update({
    where: { id: main.id },
    data: {
      name: "Mirpur Central Distribution Hub",
      address: "Section 10, Mirpur, Dhaka",
      lat: 23.806,
      lng: 90.368,
    },
  });
  await db.warehouse.upsert({
    where: { code: "WH-KAZIPARA" },
    create: {
      code: "WH-KAZIPARA",
      name: "Kazipara Forward Warehouse",
      address: "Kazipara, Dhaka",
      distributorId: distributor.id,
      lat: 23.797,
      lng: 90.373,
    },
    update: {},
  });
  if (
    await db.auditLog.findFirst({ where: { action: "ADVANCED_DEMO_SEEDED" } })
  ) {
    console.log(
      "Advanced demo already initialized. Opening batches reconciled.",
    );
    return;
  }
  const invoices = await db.invoice.findMany({
    include: { delivery: { include: { order: true } } },
  });
  for (const invoice of invoices)
    await db.serial((tx) =>
      journal(
        tx,
        admin,
        invoice.delivery.order.distributorId,
        `SALE-${invoice.delivery.orderId}`,
        `Opening sales invoice ${invoice.number}`,
        [
          moneyLine("ACCOUNTS_RECEIVABLE", invoice.totalMinor),
          moneyLine("SALES", 0, invoice.totalMinor),
        ],
      ),
    );
  const collections = await db.collection.findMany({
    where: {
      OR: [
        { method: { not: "CHEQUE" }, status: { not: "BOUNCED" } },
        { method: "CHEQUE", status: "RECONCILED" },
      ],
    },
  });
  for (const c of collections)
    if (
      !(await db.journalEntry.findFirst({
        where: {
          OR: [
            { reference: `COL-${c.id}` },
            { reference: { startsWith: `COL-${c.id}-` } },
          ],
        },
      }))
    )
      await db.serial((tx) =>
        journal(
          tx,
          admin,
          distributor.id,
          `COL-${c.id}`,
          "Opening customer collections",
          [
            moneyLine(
              c.method === "CASH"
                ? "FIELD_CASH"
                : c.method === "CHEQUE"
                  ? "BANK"
                  : c.method,
              c.amountMinor,
            ),
            moneyLine("ACCOUNTS_RECEIVABLE", 0, c.amountMinor),
          ],
        ),
      );
  const skus = await db.sku.findMany({ orderBy: { code: "asc" } }),
    price = await db.priceList.findFirstOrThrow({
      where: { active: true },
      orderBy: { version: "desc" },
      include: { items: true },
    }),
    suppliers = [];
  for (const [code, name, contact] of [
    ["SUP-MEGHNA", "Meghna Consumer Products", "Rashed Islam"],
    ["SUP-ACI", "ACI Trade Supply", "Samira Rahman"],
    ["SUP-PRAN", "PRAN Distribution Supply", "Faisal Ahmed"],
  ])
    suppliers.push(
      await db.supplier.upsert({
        where: { code },
        create: {
          code,
          name,
          contact,
          phone: "01712345678",
          paymentTermsDays: 30,
        },
        update: {},
      }),
    );
  for (let i = 0; i < 4; i++) {
    const po = await procure.create(admin, {
      clientId: uuid(`po-${i}`),
      supplierId: suppliers[i % 3].id,
      distributorId: distributor.id,
      expectedOn: new Date(Date.now() + (i + 1) * 86400000).toISOString(),
      freightMinor: 120000,
      taxBps: 0,
      notes: "Demonstration replenishment order",
      lines: skus
        .slice(i * 2, i * 2 + 2)
        .map((s) => ({
          skuId: s.id,
          qty: 48,
          unitCostMinor: Math.round(
            (price.items.find((p) => p.skuId === s.id)?.priceMinor || 10000) *
              0.7,
          ),
        })),
    });
    let current = await db.purchaseOrder.findUniqueOrThrow({
      where: { id: po.id },
      include: { lines: true },
    });
    if (i > 0 && current.status === "DRAFT")
      await procure.approve(admin, po.id, "APPROVED");
    if (
      (i >= 2 && ["APPROVED", "PARTIAL"].includes(current.status)) ||
      (i >= 2 && current.status === "DRAFT")
    ) {
      const payload = {
        clientId: uuid(`grn-${i}`),
        warehouseId: main.id,
        lines: current.lines.map((l) => ({
          purchaseLineId: l.id,
          qty: i === 2 ? 24 : 48,
          lot: `DEMO-${i}-${l.skuId.slice(-5)}`,
          expiresOn: new Date(
            Date.now() + (i === 2 ? 21 : 180) * 86400000,
          ).toISOString(),
        })),
      };
      await procure.receive(admin, po.id, payload);
    }
  }
  const vehicle = await db.vehicle.upsert({
    where: { registration: "DHAKA-METRO-NA-21-4821" },
    create: {
      name: "Mirpur Delivery Van",
      registration: "DHAKA-METRO-NA-21-4821",
      distributorId: distributor.id,
      capacityKg: 1200,
    },
    update: {},
  });
  await db.vehicle.upsert({
    where: { registration: "DHAKA-METRO-TA-18-6250" },
    create: {
      name: "North Dhaka Mini Truck",
      registration: "DHAKA-METRO-TA-18-6250",
      distributorId: distributor.id,
      capacityKg: 2500,
    },
    update: {},
  });
  if (
    !(await db.deliveryTrip.count({ where: { distributorId: distributor.id } }))
  ) {
    const orders = await db.secondaryOrder.findMany({
      where: { distributorId: distributor.id, status: "ALLOCATED" },
      take: 3,
    });
    if (orders.length)
      await field.trip(admin, {
        warehouseId: main.id,
        vehicleId: vehicle.id,
        driverId: sr.id,
        scheduledOn: new Date().toISOString(),
        orderIds: orders.map((o) => o.id),
      });
  }
  const outlets = await db.outlet.findMany({
    where: { beat: { territoryId: distributor.territoryId } },
    orderBy: { code: "asc" },
    take: 8,
  });
  const tasks = [
    ["Visibility & shelf availability", "MERCHANDISING", "URGENT"],
    ["Retail pricing verification", "PRICE_AUDIT", "HIGH"],
    ["Competitor promotion check", "COMPETITOR", "NORMAL"],
    ["Recover lapsed order opportunity", "FOLLOW_UP", "HIGH"],
    ["Focus SKU assortment audit", "ASSORTMENT", "NORMAL"],
  ];
  for (let i = 0; i < tasks.length; i++)
    if (!(await db.fieldTask.findFirst({ where: { title: tasks[i][0] } })))
      await field.task(admin, {
        title: tasks[i][0],
        type: tasks[i][1],
        priority: tasks[i][2],
        assignedTo: sr.id,
        outletId: outlets[i].id,
        dueOn: new Date(
          Date.now() + (i === 0 ? -1 : i) * 86400000,
        ).toISOString(),
        checklist: [
          "Verify assigned outlet condition",
          "Record findings and next action",
          "Attach company evidence reference",
        ],
      });
  for (const [i, title] of [
    "Expand cooking essentials range",
    "Launch beverage assortment",
    "Restore weekly ordering",
    "Grow pharmacy personal care",
  ].entries())
    if (!(await db.salesOpportunity.findFirst({ where: { title } }))) {
      const opportunity = await field.opportunity(sr, {
        title,
        outletId: outlets[i].id,
        valueMinor: (i + 1) * 1500000,
        expectedOn: new Date(Date.now() + (i + 3) * 86400000).toISOString(),
        notes: "Agree next steps with the outlet owner and distributor.",
      });
      if (i > 0) await field.stage(sr, opportunity.id, { stage: "PROPOSAL" });
      if (i > 1)
        await field.stage(sr, opportunity.id, { stage: "NEGOTIATION" });
    }
  await db.outlet.updateMany({
    where: { id: { in: outlets.slice(0, 2).map((o) => o.id) } },
    data: { segment: "KEY_ACCOUNT", paymentTermsDays: 14 },
  });
  await db.auditLog.create({
    data: {
      actorId: admin.id,
      action: "ADVANCED_DEMO_SEEDED",
      entityId: distributor.id,
      details: { suppliers: suppliers.length, warehouses: 2, vehicles: 2 },
    },
  });
  console.log(
    "Initialized advanced warehouses, opening journals, suppliers, purchase pipeline, receipts, fleet, trip, tasks and sales opportunities. Opening stock has unknown cost (0) until costed procurement.",
  );
}
seed().finally(() => db.$disconnect());
