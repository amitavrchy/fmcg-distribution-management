import { test } from "node:test";
import assert from "node:assert/strict";
import { canTransition } from "../src/domain/transitions";
import { distanceMeters, dhakaDate } from "../src/domain/geo";
import { parse, orderInput } from "../src/validation";
test("delivered orders are terminal and dispatch cannot be skipped", () => {
  assert.equal(canTransition("DELIVERED", "DELIVERED"), false);
  assert.equal(canTransition("CONFIRMED", "DELIVERED"), false);
  assert.equal(canTransition("PENDING_APPROVAL", "CONFIRMED"), true);
});
test("GPS distance is zero for identical location and flags distant points", () => {
  assert.equal(distanceMeters(23.8, 90.3, 23.8, 90.3), 0);
  assert.ok(distanceMeters(23.8, 90.3, 23.9, 90.3) > 10000);
});
test("Dhaka business day crosses UTC date boundary", () => {
  assert.equal(dhakaDate(new Date("2026-11-04T20:00:00Z")), "2026-11-05");
});
test("invalid client key and fractional product quantities are rejected", () => {
  assert.throws(() =>
    parse(orderInput, {
      clientOrderId: "bad",
      lines: [{ skuId: "sku", qty: 1.5 }],
    }),
  );
});
