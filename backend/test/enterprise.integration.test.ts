import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import { Db } from "../src/db";
import { ProcurementService } from "../src/enterprise/procurement.service";
import { WarehouseService } from "../src/enterprise/warehouse.service";
import { ReturnsService } from "../src/enterprise/returns.service";
import { FieldService } from "../src/enterprise/field.service";
import { FinanceService } from "../src/enterprise/finance.service";
import { EnterpriseRead } from "../src/enterprise/read.service";
import { ImportService } from "../src/enterprise/import.service";
import { OrdersService } from "../src/orders.service";
import { CollectionsService } from "../src/collections.service";
import { balanced, invoiceDue, JournalLine } from "../src/domain/enterprise";
import { dhakaDate } from "../src/domain/geo";
test(
  "enterprise lifecycle: purchasing FEFO dispatch POD returns credits refunds transfers counts and controls",
  { skip: process.env.RUN_INTEGRATION !== "1" },
  async () => {
    const db = new Db(),
      key = randomUUID(),
      admin = await db.user.findFirstOrThrow({
        where: { role: "COMPANY_ADMIN" },
      }),
      sku = await db.sku.findUniqueOrThrow({ where: { code: "SKU-001" } }),
      price = await db.priceList.findFirstOrThrow({
        where: { active: true },
        orderBy: { version: "desc" },
        include: { items: true },
      });
    const region = await db.region.create({
        data: { name: `Enterprise ${key}` },
      }),
      area = await db.area.create({
        data: { name: "Test area", regionId: region.id },
      }),
      territory = await db.territory.create({
        data: { name: "Test territory", areaId: area.id },
      }),
      beat = await db.beat.create({
        data: { name: "Test beat", weekday: 1, territoryId: territory.id },
      }),
      dist = await db.distributor.create({
        data: { name: "Test partner", code: key, territoryId: territory.id },
      }),
      sr = await db.user.create({
        data: {
          email: `${key}@enterprise.test`,
          fullName: "Test Field Rep",
          role: "SR",
          passwordHash: "no-login",
          territoryId: territory.id,
        },
      }),
      outlet = await db.outlet.create({
        data: {
          name: "Test store",
          code: key,
          owner: "Owner",
          phone: "01700000000",
          address: "Test road",
          beatId: beat.id,
          creditLimitMinor: 100000000,
          lat: 23.806,
          lng: 90.368,
        },
      });
    const procure = new ProcurementService(db),
      warehouse = new WarehouseService(db),
      returns = new ReturnsService(db),
      orders = new OrdersService(db),
      payments = new CollectionsService(db),
      field = new FieldService(db, orders),
      finance = new FinanceService(db),
      imports = new ImportService(db);
    let supplierId = "";
    try {
      const wh = await warehouse.create(admin, {
          name: "Test depot",
          code: `A-${key}`,
          address: "Test road",
          distributorId: dist.id,
          lat: 23.8,
          lng: 90.36,
        }),
        wh2 = await warehouse.create(admin, {
          name: "Test satellite",
          code: `B-${key}`,
          address: "Other road",
          distributorId: dist.id,
          lat: 23.81,
          lng: 90.37,
        });
      const supplier = await procure.supplier(admin, {
        name: "Test supplier",
        code: key,
        contact: "Supply owner",
        phone: "01712345678",
        paymentTermsDays: 30,
      });
      supplierId = supplier.id;
      const po = await procure.create(admin, {
        clientId: randomUUID(),
        supplierId: supplier.id,
        distributorId: dist.id,
        expectedOn: new Date().toISOString(),
        freightMinor: 10001,
        taxBps: 500,
        lines: [{ skuId: sku.id, qty: 20, unitCostMinor: 10000 }],
      });
      await assert.rejects(() =>
        procure.receive(admin, po.id, {
          clientId: randomUUID(),
          warehouseId: wh.id,
          lines: [],
        }),
      );
      await procure.approve(admin, po.id, "APPROVED");
      const pol = await db.purchaseOrderLine.findFirstOrThrow({
        where: { purchaseId: po.id },
      });
      const receipt = {
        clientId: randomUUID(),
        warehouseId: wh.id,
        lines: [
          {
            purchaseLineId: pol.id,
            qty: 10,
            lot: "NEAR",
            expiresOn: new Date(Date.now() + 7 * 86400000).toISOString(),
          },
        ],
      };
      const grn = await procure.receive(admin, po.id, receipt);
      assert.equal((await procure.receive(admin, po.id, receipt)).id, grn.id);
      await procure.receive(admin, po.id, {
        clientId: randomUUID(),
        warehouseId: wh.id,
        lines: [
          {
            purchaseLineId: pol.id,
            qty: 10,
            lot: "FAR",
            expiresOn: new Date(Date.now() + 90 * 86400000).toISOString(),
          },
        ],
      });
      assert.equal(
        (await db.purchaseOrder.findUniqueOrThrow({ where: { id: po.id } }))
          .status,
        "RECEIVED",
      );
      const payable = await db.supplierPayable.findUniqueOrThrow({
        where: { purchaseId: po.id },
      });
      assert.equal(payable.totalMinor, 220001);
      await procure.pay(admin, payable.id, {
        clientId: randomUUID(),
        amountMinor: 100000,
        method: "BANK",
        reference: "TEST-BANK",
      });
      await assert.rejects(() =>
        procure.pay(admin, payable.id, {
          clientId: randomUUID(),
          amountMinor: 200000,
          method: "BANK",
          reference: "OVERPAY",
        }),
      );
      const createOrder = async (qty: number) =>
        (await orders.create(sr, {
          clientOrderId: randomUUID(),
          outletId: outlet.id,
          distributorId: dist.id,
          priceListVersion: price.version,
          orderedAt: new Date().toISOString(),
          lines: [{ skuId: sku.id, qty }],
        })) as { id: string };
      const first = await createOrder(8);
      await orders.transition(admin, first.id, "CONFIRMED");
      await orders.transition(admin, first.id, "ALLOCATED");
      const allocations = await db.batchAllocation.findMany({
        where: { orderLine: { orderId: first.id } },
        include: { batch: true },
      });
      assert.equal(allocations.length, 1);
      assert.equal(allocations[0].batch.lot, "NEAR");
      assert.equal(allocations[0].qty, 8);
      const reservedAssets = await new EnterpriseRead(db).snapshot({
        ...sr,
        role: "DISTRIBUTOR",
        distributorId: dist.id,
      });
      assert.equal(reservedAssets.summary.inventoryValueMinor, 210000);
      await assert.rejects(() =>
        db.stockBatch.update({
          where: { id: allocations[0].batchId },
          data: { qty: -1 },
        }),
      );
      const vehicle = await field.vehicle(admin, {
        registration: key,
        name: "Test delivery van",
        distributorId: dist.id,
        capacityKg: 1000,
      });
      const trip = await field.trip(admin, {
        warehouseId: wh.id,
        vehicleId: vehicle.id,
        driverId: sr.id,
        scheduledOn: new Date().toISOString(),
        orderIds: [first.id],
      });
      await field.tripAction(sr, trip.id, "IN_PROGRESS");
      const stop = await db.tripStop.findFirstOrThrow({
        where: { tripId: trip.id },
      });
      await assert.rejects(() =>
        field.stop(sr, stop.id, {
          status: "DELIVERED",
          recipientName: "",
          proofReference: "",
        }),
      );
      await field.stop(sr, stop.id, {
        status: "DELIVERED",
        recipientName: "Retail owner",
        proofReference: "SIGNED-CHALLAN-123",
        lat: 23.806,
        lng: 90.368,
      });
      await field.tripAction(sr, trip.id, "CLOSED");
      assert.equal(
        (await db.secondaryOrder.findUniqueOrThrow({ where: { id: first.id } }))
          .status,
        "DELIVERED",
      );
      const invoice = await db.invoice.findFirstOrThrow({
        where: { delivery: { orderId: first.id } },
      });
      await payments.create(sr, {
        clientCollectionId: randomUUID(),
        outletId: outlet.id,
        amountMinor: invoice.totalMinor,
        method: "CASH",
        reference: "",
      });
      const orderLine = await db.secondaryOrderLine.findFirstOrThrow({
        where: { orderId: first.id },
      });
      const rma = await returns.create(sr, {
        clientId: randomUUID(),
        orderId: first.id,
        reason: "Two sealed units returned by outlet",
        lines: [
          {
            orderLineId: orderLine.id,
            qty: 2,
            freeQty: 0,
            disposition: "RESTOCK",
          },
        ],
      });
      await returns.review(admin, rma.id, "APPROVED");
      const credit = await returns.receive(admin, rma.id, {
        warehouseId: wh.id,
      });
      assert.ok(credit.refundMinor > 0);
      assert.equal(credit.appliedMinor, 0);
      assert.equal(
        (await returns.receive(admin, rma.id, { warehouseId: wh.id })).id,
        credit.id,
      );
      await returns.refund(admin, credit.id, {
        method: "CASH",
        reference: "REFUND-123",
      });
      assert.equal(
        (await db.returnRequest.findUniqueOrThrow({ where: { id: rma.id } }))
          .status,
        "SETTLED",
      );
      await assert.rejects(() =>
        returns.create(sr, {
          clientId: randomUUID(),
          orderId: first.id,
          reason: "Over return should be rejected",
          lines: [
            {
              orderLineId: orderLine.id,
              qty: 7,
              freeQty: 0,
              disposition: "RESTOCK",
            },
          ],
        }),
      );
      const second = await createOrder(4);
      for (const status of [
        "CONFIRMED",
        "ALLOCATED",
        "DISPATCHED",
        "DELIVERED",
      ])
        await orders.transition(admin, second.id, status);
      const secondLine = await db.secondaryOrderLine.findFirstOrThrow({
          where: { orderId: second.id },
        }),
        secondInvoice = await db.invoice.findFirstOrThrow({
          where: { delivery: { orderId: second.id } },
        });
      const rma2 = await returns.create(sr, {
        clientId: randomUUID(),
        orderId: second.id,
        reason: "One unit returned before collection",
        lines: [
          {
            orderLineId: secondLine.id,
            qty: 1,
            freeQty: 0,
            disposition: "QUARANTINE",
          },
        ],
      });
      await returns.review(admin, rma2.id, "APPROVED");
      const credit2 = await returns.receive(admin, rma2.id, {
        warehouseId: wh.id,
      });
      assert.ok(credit2.appliedMinor > 0);
      assert.equal(credit2.refundMinor, 0);
      assert.equal(
        invoiceDue(
          await db.invoice.findUniqueOrThrow({
            where: { id: secondInvoice.id },
          }),
        ),
        secondInvoice.totalMinor - credit2.appliedMinor,
      );
      const far = await db.stockBatch.findFirstOrThrow({
        where: { warehouseId: wh.id, skuId: sku.id, lot: "FAR" },
      });
      const tr = await warehouse.transfer(admin, {
        clientId: randomUUID(),
        batchId: far.id,
        targetWarehouseId: wh2.id,
        qty: 2,
      });
      await warehouse.transferAction(admin, tr.id, "IN_TRANSIT");
      await warehouse.transferAction(admin, tr.id, "RECEIVED");
      assert.equal(
        (
          await db.stockBatch.findFirstOrThrow({
            where: { warehouseId: wh2.id, lot: "FAR" },
          })
        ).qty,
        2,
      );
      const target = await db.stockBatch.findFirstOrThrow({
          where: { warehouseId: wh2.id, lot: "FAR" },
        }),
        count = await warehouse.count(admin, {
          warehouseId: wh2.id,
          notes: "Physical test count",
          lines: [{ batchId: target.id, countedQty: 1 }],
        });
      await warehouse.approveCount(admin, count.id, "APPROVED");
      assert.equal(
        (await db.stockBatch.findUniqueOrThrow({ where: { id: target.id } }))
          .qty,
        1,
      );
      const near = await db.stockBatch.findFirstOrThrow({
        where: { warehouseId: wh.id, lot: "NEAR" },
      });
      await warehouse.batchStatus(admin, near.id, {
        status: "RECALLED",
        reason: "Manufacturer quality recall test",
      });
      const derived = await db.stockBatch.findMany({
        where: { originBatchIds: { has: near.id } },
      });
      assert.ok(derived.length > 0);
      assert.ok(derived.every((b) => b.status === "RECALLED"));
      await assert.rejects(() =>
        warehouse.batchStatus(admin, near.id, {
          status: "AVAILABLE",
          reason: "Cannot release a recalled lot",
        }),
      );
      const task = await field.task(admin, {
        title: "Shelf audit",
        type: "MERCHANDISING",
        outletId: outlet.id,
        assignedTo: sr.id,
        dueOn: new Date().toISOString(),
        priority: "HIGH",
        checklist: ["Verify shelf", "Capture competitor"],
      });
      await assert.rejects(() =>
        field.completeTask(sr, task.id, {
          checks: [true, false],
          notes: "Incomplete",
          evidenceReference: "EVIDENCE",
        }),
      );
      await field.completeTask(sr, task.id, {
        checks: [true, true],
        notes: "Shelf and competitor verified",
        evidenceReference: "AUDIT-123",
      });
      const expense = await finance.expense(sr, {
        distributorId: dist.id,
        category: "FUEL",
        amountMinor: 50000,
        description: "Delivery route fuel reimbursement",
        receiptReference: "FUEL-123",
      });
      await finance.reviewExpense(admin, expense.id, "APPROVED");
      await finance.payExpense(admin, expense.id, {
        method: "CASH",
        reference: "EXP-PAY-123",
      });
      const csv = `Code,Name,Owner,Phone,Address,Beat,CreditBDT\nIMP-${key},Imported outlet,Owner,01712345678,Test road,${beat.id},50000`;
      assert.equal((await imports.preview(admin, { csv })).ready, 1);
      assert.equal((await imports.apply(admin, { csv })).imported, 1);
      assert.equal((await imports.apply(admin, { csv })).imported, 0);
      const cash = await db.collection.aggregate({
        where: { srId: sr.id, method: "CASH" },
        _sum: { amountMinor: true },
      });
      const handover = await finance.handover(sr, {
        distributorId: dist.id,
        businessDate: dhakaDate(),
        declaredMinor: cash._sum.amountMinor || 0,
        discrepancyReason: "",
      });
      await finance.acceptHandover(admin, handover.id);
      await assert.rejects(() =>
        payments.create(sr, {
          clientCollectionId: randomUUID(),
          outletId: outlet.id,
          amountMinor: 1,
          method: "CASH",
          reference: "",
        }),
      );
      const journals = await db.journalEntry.findMany({
        where: { distributorId: dist.id },
      });
      assert.ok(journals.length >= 10);
      for (const entry of journals)
        assert.equal(balanced(entry.lines as JournalLine[]), true);
      const manager = await db.user.findFirstOrThrow({
          where: { role: "AREA_MANAGER", territoryId: { not: territory.id } },
        }),
        scoped = await new EnterpriseRead(db).snapshot(manager);
      assert.ok(!scoped.warehouses.some((w) => w.distributorId === dist.id));
      assert.ok(!scoped.purchases.some((p) => p.distributorId === dist.id));
    } finally {
      const purchaseIds = (
        await db.purchaseOrder.findMany({
          where: { distributorId: dist.id },
          select: { id: true },
        })
      ).map((x) => x.id);
      const payableIds = (
        await db.supplierPayable.findMany({
          where: { purchaseId: { in: purchaseIds } },
          select: { id: true },
        })
      ).map((x) => x.id);
      const returnIds = (
        await db.returnRequest.findMany({
          where: { order: { distributorId: dist.id } },
          select: { id: true },
        })
      ).map((x) => x.id);
      await db.creditNote.deleteMany({
        where: { returnId: { in: returnIds } },
      });
      await db.returnLine.deleteMany({
        where: { returnId: { in: returnIds } },
      });
      await db.returnRequest.deleteMany({ where: { id: { in: returnIds } } });
      await db.deliveryTrip.deleteMany({ where: { distributorId: dist.id } });
      await db.vehicle.deleteMany({ where: { distributorId: dist.id } });
      await db.collectionAllocation.deleteMany({
        where: { collection: { srId: sr.id } },
      });
      await db.collection.deleteMany({ where: { srId: sr.id } });
      await db.invoice.deleteMany({ where: { outlet: { beatId: beat.id } } });
      await db.delivery.deleteMany({
        where: { order: { distributorId: dist.id } },
      });
      await db.secondaryOrder.deleteMany({ where: { distributorId: dist.id } });
      await db.goodsReceipt.deleteMany({
        where: { purchaseId: { in: purchaseIds } },
      });
      await db.supplierPayment.deleteMany({
        where: { payableId: { in: payableIds } },
      });
      await db.supplierPayable.deleteMany({
        where: { id: { in: payableIds } },
      });
      await db.purchaseOrder.deleteMany({ where: { distributorId: dist.id } });
      await db.stockCount.deleteMany({
        where: { warehouse: { distributorId: dist.id } },
      });
      await db.stockTransfer.deleteMany({
        where: { batch: { warehouse: { distributorId: dist.id } } },
      });
      await db.stockBatch.deleteMany({
        where: { warehouse: { distributorId: dist.id } },
      });
      await db.warehouse.deleteMany({ where: { distributorId: dist.id } });
      await db.stockMovement.deleteMany({ where: { distributorId: dist.id } });
      await db.distributorStock.deleteMany({
        where: { distributorId: dist.id },
      });
      await db.fieldTask.deleteMany({ where: { assignedTo: sr.id } });
      await db.salesOpportunity.deleteMany({
        where: { territoryId: territory.id },
      });
      await db.expense.deleteMany({ where: { distributorId: dist.id } });
      await db.cashHandover.deleteMany({ where: { distributorId: dist.id } });
      await db.journalEntry.deleteMany({ where: { distributorId: dist.id } });
      await db.journeyVisit.deleteMany({ where: { srId: sr.id } });
      await db.outlet.deleteMany({ where: { beatId: beat.id } });
      await db.user.delete({ where: { id: sr.id } });
      await db.distributor.delete({ where: { id: dist.id } });
      await db.beat.delete({ where: { id: beat.id } });
      await db.territory.delete({ where: { id: territory.id } });
      await db.area.delete({ where: { id: area.id } });
      await db.region.delete({ where: { id: region.id } });
      if (supplierId) await db.supplier.delete({ where: { id: supplierId } });
      await db.$disconnect();
    }
  },
);
