import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import { Db } from "../src/db";
import { OrdersService } from "../src/orders.service";
import { CollectionsService } from "../src/collections.service";
import { ReadService } from "../src/read.service";
test(
  "database acceptance: scope, credit override, idempotency, partial stock, delivery, FIFO and clearing",
  { skip: process.env.RUN_INTEGRATION !== "1" },
  async () => {
    const db = new Db(),
      suffix = randomUUID(),
      orders = new OrdersService(db),
      payments = new CollectionsService(db);
    const admin = await db.user.findFirstOrThrow({
      where: { role: "COMPANY_ADMIN" },
    });
    const sku = await db.sku.findFirstOrThrow({ where: { active: true } });
    const price = await db.priceList.findFirstOrThrow({
      where: { active: true },
      orderBy: { version: "desc" },
      include: { items: true },
    });
    const region = await db.region.create({
      data: { name: `Test region ${suffix}` },
    });
    const area = await db.area.create({
      data: { name: "Isolated area", regionId: region.id },
    });
    const territory = await db.territory.create({
      data: { name: "Isolated territory", areaId: area.id },
    });
    const beat = await db.beat.create({
      data: { name: "Test beat", weekday: 1, territoryId: territory.id },
    });
    const distributor = await db.distributor.create({
      data: { name: "Test partner", code: suffix, territoryId: territory.id },
    });
    const sr = await db.user.create({
      data: {
        email: `${suffix}@test.local`,
        fullName: "Test SR",
        role: "SR",
        passwordHash: "test-only-no-login",
        territoryId: territory.id,
      },
    });
    const outlet = await db.outlet.create({
      data: {
        name: "Test outlet",
        code: suffix,
        owner: "Test owner",
        phone: "01700000000",
        address: "Test address",
        beatId: beat.id,
        creditLimitMinor: 1,
      },
    });
    const orderIds: string[] = [],
      collectionIds: string[] = [];
    const testScheme = await db.scheme.create({
      data: {
        name: `Test free goods ${suffix}`,
        priority: 0,
        startsOn: new Date(Date.now() - 86400000),
        endsOn: new Date(Date.now() + 86400000),
        rules: { type: "FREE", skuId: sku.id, buyQty: 2, freeQty: 1 },
      },
    });
    try {
      await db.distributorStock.create({
        data: { distributorId: distributor.id, skuId: sku.id, qty: 5 },
      });
      const manager = await db.user.findFirstOrThrow({
        where: { role: "AREA_MANAGER", territoryId: { not: territory.id } },
      });
      const snapshot = await new ReadService(db).snapshot(manager);
      assert.ok(!snapshot.outlets.some((o) => o.id === outlet.id));
      assert.ok(!snapshot.distributors.some((d) => d.id === distributor.id));
      const payload = {
        clientOrderId: randomUUID(),
        outletId: outlet.id,
        distributorId: distributor.id,
        priceListVersion: price.version,
        orderedAt: new Date().toISOString(),
        lines: [{ skuId: sku.id, qty: 10 }],
      };
      const simultaneous = await Promise.all([
        orders.create(sr, payload),
        orders.create(sr, payload),
      ]);
      const created = simultaneous[0] as {
        id: string;
        status: string;
      };
      orderIds.push(created.id);
      assert.equal((simultaneous[1] as { id: string }).id, created.id);
      assert.equal(created.status, "PENDING_APPROVAL");
      assert.equal(
        ((await orders.create(sr, payload)) as { id: string }).id,
        created.id,
      );
      await assert.rejects(() =>
        orders.transition(
          { ...sr, role: "DISTRIBUTOR", distributorId: distributor.id },
          created.id,
          "CONFIRMED",
        ),
      );
      await orders.transition(admin, created.id, "CONFIRMED");
      await orders.transition(admin, created.id, "ALLOCATED");
      let stock = await db.distributorStock.findUniqueOrThrow({
        where: {
          distributorId_skuId: { distributorId: distributor.id, skuId: sku.id },
        },
      });
      assert.equal(stock.qty, 0);
      const partial = await db.secondaryOrder.findUniqueOrThrow({
        where: { id: created.id },
        include: { lines: true },
      });
      assert.equal(partial.backorder, true);
      assert.equal(partial.lines[0].allocatedQty, 5);
      assert.equal(partial.lines[0].freeQty, 5);
      assert.equal(partial.lines[0].allocatedFreeQty, 0);
      await orders.transition(admin, created.id, "DISPATCHED");
      const deliveries = await Promise.allSettled([
        orders.transition(admin, created.id, "DELIVERED"),
        orders.transition(admin, created.id, "DELIVERED"),
      ]);
      assert.equal(
        deliveries.filter((r) => r.status === "fulfilled").length,
        1,
      );
      const invoice = await db.invoice.findFirstOrThrow({
        where: { delivery: { orderId: created.id } },
      });
      assert.ok(invoice.totalMinor > 0);
      assert.equal(
        invoice.totalMinor,
        5 * price.items.find((p) => p.skuId === sku.id)!.priceMinor,
      );
      const amount = Math.floor(invoice.totalMinor / 2),
        clientCollectionId = randomUUID();
      const payment = await payments.create(sr, {
        clientCollectionId,
        outletId: outlet.id,
        amountMinor: amount,
        method: "CASH",
        reference: "",
      });
      collectionIds.push(payment.id);
      assert.equal(
        (
          await payments.create(sr, {
            clientCollectionId,
            outletId: outlet.id,
            amountMinor: amount,
            method: "CASH",
            reference: "",
          })
        ).id,
        payment.id,
      );
      const cheque = await payments.create(sr, {
        clientCollectionId: randomUUID(),
        outletId: outlet.id,
        amountMinor: invoice.totalMinor - amount,
        method: "CHEQUE",
        reference: "TEST-CHEQUE",
      });
      collectionIds.push(cheque.id);
      assert.equal(
        (await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } }))
          .paidMinor,
        amount,
      );
      await payments.reconcile(admin, cheque.id, "RECONCILED");
      assert.equal(
        (await db.invoice.findUniqueOrThrow({ where: { id: invoice.id } }))
          .status,
        "PAID",
      );
      await assert.rejects(() =>
        payments.reconcile(admin, cheque.id, "RECONCILED"),
      );
      await assert.rejects(() =>
        payments.create(sr, {
          clientCollectionId: randomUUID(),
          outletId: outlet.id,
          amountMinor: 1,
          method: "CASH",
          reference: "",
        }),
      );
      await db.distributorStock.update({
        where: {
          distributorId_skuId: { distributorId: distributor.id, skuId: sku.id },
        },
        data: { qty: 5 },
      });
      const cancelOrder = (await orders.create(sr, {
        ...payload,
        clientOrderId: randomUUID(),
        lines: [{ skuId: sku.id, qty: 2 }],
      })) as { id: string };
      orderIds.push(cancelOrder.id);
      await orders.transition(admin, cancelOrder.id, "CONFIRMED");
      await orders.transition(admin, cancelOrder.id, "ALLOCATED");
      assert.equal(
        (
          await db.distributorStock.findUniqueOrThrow({
            where: {
              distributorId_skuId: {
                distributorId: distributor.id,
                skuId: sku.id,
              },
            },
          })
        ).qty,
        2,
      );
      await orders.transition(admin, cancelOrder.id, "CANCELLED");
      assert.equal(
        (
          await db.distributorStock.findUniqueOrThrow({
            where: {
              distributorId_skuId: {
                distributorId: distributor.id,
                skuId: sku.id,
              },
            },
          })
        ).qty,
        5,
      );
    } finally {
      await db.scheme.delete({ where: { id: testScheme.id } });
      await db.collectionAllocation.deleteMany({
        where: { collectionId: { in: collectionIds } },
      });
      await db.collection.deleteMany({ where: { srId: sr.id } });
      await db.invoice.deleteMany({ where: { outletId: outlet.id } });
      await db.delivery.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.secondaryOrder.deleteMany({ where: { srId: sr.id } });
      await db.stockMovement.deleteMany({
        where: { distributorId: distributor.id },
      });
      await db.stockBatch.deleteMany({
        where: { warehouse: { distributorId: distributor.id } },
      });
      await db.warehouse.deleteMany({
        where: { distributorId: distributor.id },
      });
      await db.journalEntry.deleteMany({
        where: { distributorId: distributor.id },
      });
      await db.distributorStock.deleteMany({
        where: { distributorId: distributor.id },
      });
      await db.journeyVisit.deleteMany({ where: { srId: sr.id } });
      await db.auditLog.deleteMany({
        where: {
          OR: [
            { actorId: sr.id },
            { entityId: { in: [...orderIds, ...collectionIds] } },
          ],
        },
      });
      await db.outlet.delete({ where: { id: outlet.id } });
      await db.user.delete({ where: { id: sr.id } });
      await db.distributor.delete({ where: { id: distributor.id } });
      await db.beat.delete({ where: { id: beat.id } });
      await db.territory.delete({ where: { id: territory.id } });
      await db.area.delete({ where: { id: area.id } });
      await db.region.delete({ where: { id: region.id } });
      await db.$disconnect();
    }
  },
);
