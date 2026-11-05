import { test } from "node:test";
import assert from "node:assert/strict";
import { preview, Promotion } from "../src/domain/schemes";
const at = new Date("2026-11-05T00:00:00Z");
const scheme = (rules: unknown, priority = 10, id = "a"): Promotion => ({
  id,
  name: id,
  priority,
  active: true,
  startsOn: new Date("2026-11-01"),
  endsOn: new Date("2026-11-30"),
  rules,
});
test("free goods use complete quantity slabs", () => {
  assert.equal(
    preview(
      [{ skuId: "s", qty: 25, unitPriceMinor: 100 }],
      [scheme({ type: "FREE", skuId: "s", buyQty: 12, freeQty: 1 })],
      at,
    ).free.s,
    2,
  );
});
test("priority and stable IDs determine cascading discounts", () => {
  const r = preview(
    [{ skuId: "s", qty: 10, unitPriceMinor: 100 }],
    [
      scheme({ type: "PERCENT", value: 10 }, 20, "b"),
      scheme({ type: "AMOUNT", value: 100 }, 10),
    ],
    at,
  );
  assert.equal(r.totalMinor, 810);
  assert.deepEqual(r.applied, ["a", "b"]);
});
test("expired and below threshold schemes do not apply", () => {
  const s = scheme({ type: "AMOUNT", value: 100, minMinor: 10000 });
  assert.equal(
    preview([{ skuId: "s", qty: 1, unitPriceMinor: 100 }], [s], at)
      .discountMinor,
    0,
  );
  assert.equal(
    preview(
      [{ skuId: "s", qty: 100, unitPriceMinor: 100 }],
      [s],
      new Date("2026-12-01"),
    ).discountMinor,
    0,
  );
});
test("combo requires every SKU and discount never exceeds goods", () => {
  const s = scheme({ type: "COMBO", requires: ["a", "b"], value: 9999 });
  assert.equal(
    preview([{ skuId: "a", qty: 1, unitPriceMinor: 100 }], [s], at)
      .discountMinor,
    0,
  );
  assert.equal(
    preview(
      [
        { skuId: "a", qty: 1, unitPriceMinor: 100 },
        { skuId: "b", qty: 1, unitPriceMinor: 100 },
      ],
      [s],
      at,
    ).totalMinor,
    0,
  );
});
