import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
test("API rejects anonymous access and malicious origin", async ({
  request,
}) => {
  expect((await request.get("/api/snapshot")).status()).toBe(401);
  expect(
    (
      await request.post("/api/auth/login", {
        headers: { origin: "https://untrusted.example" },
        data: {
          email: "admin@fmcg.local",
          password: process.env.SEED_PASSWORD,
        },
      })
    ).status(),
  ).toBe(403);
});
test("sales order idempotency stale pricing and role boundaries", async ({
  request,
}) => {
  expect(
    (
      await request.post("/api/auth/login", {
        data: { email: "sr@fmcg.local", password: process.env.SEED_PASSWORD },
      })
    ).ok(),
  ).toBe(true);
  const snapshot = await (await request.get("/api/snapshot")).json();
  const payload = {
    clientOrderId: randomUUID(),
    outletId: snapshot.outlets.find(
      (o: { code: string }) => o.code === "OUT-001",
    ).id,
    distributorId: snapshot.distributors[0].id,
    priceListVersion: snapshot.prices.version,
    orderedAt: new Date().toISOString(),
    lines: [{ skuId: snapshot.skus[0].id, qty: 1 }],
  };
  const first = await request.post("/api/orders", { data: payload });
  expect(first.ok()).toBe(true);
  const created = await first.json();
  const duplicate = await (
    await request.post("/api/orders", { data: payload })
  ).json();
  expect(duplicate.id).toBe(created.id);
  expect(
    (
      await request.post("/api/orders", {
        data: {
          ...payload,
          clientOrderId: randomUUID(),
          priceListVersion: 999999,
        },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await request.patch(`/api/orders/${created.id}/status`, {
        data: { status: "CONFIRMED" },
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await request.post("/api/stock/receive", {
        data: {
          distributorId: snapshot.distributors[0].id,
          skuId: snapshot.skus[0].id,
          qty: 10,
          reference: "FORBIDDEN",
        },
      })
    ).status(),
  ).toBe(403);
});
