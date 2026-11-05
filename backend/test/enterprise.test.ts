import { test } from "node:test";
import assert from "node:assert/strict";
import {
  balanced,
  invoiceDue,
  aging,
  replenishment,
  abc,
  optimizeStops,
} from "../src/domain/enterprise";
import { parseCsv } from "../src/domain/csv";
test("journal rejects imbalance negative values and dual-sided lines", () => {
  assert.equal(
    balanced([
      { account: "AR", debitMinor: 100, creditMinor: 0 },
      { account: "SALES", debitMinor: 0, creditMinor: 100 },
    ]),
    true,
  );
  assert.equal(
    balanced([
      { account: "AR", debitMinor: 100, creditMinor: 0 },
      { account: "SALES", debitMinor: 0, creditMinor: 99 },
    ]),
    false,
  );
  assert.equal(
    balanced([
      { account: "AR", debitMinor: 100, creditMinor: 100 },
      { account: "SALES", debitMinor: 0, creditMinor: 0 },
    ]),
    false,
  );
});
test("customer credits reduce collectible balance without changing bank receipts", () => {
  assert.equal(
    invoiceDue({ totalMinor: 1000, paidMinor: 400, creditedMinor: 250 }),
    350,
  );
  assert.equal(
    invoiceDue({ totalMinor: 100, paidMinor: 90, creditedMinor: 20 }),
    0,
  );
});
test("aging respects customer payment terms", () => {
  const now = new Date("2026-11-05T00:00:00Z");
  assert.deepEqual(aging(new Date("2026-10-01T00:00:00Z"), 30, now), {
    days: 5,
    bucket: "1–30",
  });
  assert.equal(aging(now, 30, now).bucket, "CURRENT");
});
test("replenishment uses lead and safety days and treats zero demand honestly", () => {
  assert.deepEqual(replenishment(300, 30, 70, 7, 5), {
    dailyDemand: 10,
    daysCover: 7,
    suggestedQty: 50,
  });
  assert.equal(replenishment(0, 30, 100, 7, 5).daysCover, null);
});
test("ABC ranks contributions and classifies zero demand as C", () => {
  const result = abc([
    { id: "a", valueMinor: 800 },
    { id: "b", valueMinor: 150 },
    { id: "c", valueMinor: 50 },
    { id: "d", valueMinor: 0 },
  ]);
  assert.deepEqual(
    result.map((r) => r.classification),
    ["A", "B", "C", "C"],
  );
});
test("nearest-neighbor route visits each stop once and returns to depot", () => {
  const r = optimizeStops({ lat: 23, lng: 90 }, [
    { id: "far", lat: 23.2, lng: 90 },
    { id: "near", lat: 23.01, lng: 90 },
  ]);
  assert.deepEqual(
    r.stops.map((s) => s.id),
    ["near", "far"],
  );
  assert.ok(r.distanceKm > 40);
});
test("CSV handles escaped quotes commas BOM and multiline fields", () => {
  assert.deepEqual(
    parseCsv('\uFEFFName,Address\r\n"A ""store""","Road 1,\nDhaka"'),
    [
      ["Name", "Address"],
      ['A "store"', "Road 1,\nDhaka"],
    ],
  );
  assert.throws(() => parseCsv('Name\n"open'));
  assert.throws(() => parseCsv("Name\na\nb", 1));
});
