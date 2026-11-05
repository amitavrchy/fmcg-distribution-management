import { test } from "node:test";
import assert from "node:assert/strict";
import { fifo } from "../src/domain/fifo";
import { exceedsCredit } from "../src/domain/credit";
import { calculateIncentive } from "../src/domain/incentives";
import { safeMinor, proportional } from "../src/domain/money";
test("FIFO clears oldest invoice before partial next", () => {
  assert.deepEqual(
    fifo(900, [
      { id: "old", totalMinor: 1000, paidMinor: 400 },
      { id: "new", totalMinor: 500, paidMinor: 0 },
    ]),
    {
      allocations: [
        { invoiceId: "old", amountMinor: 600 },
        { invoiceId: "new", amountMinor: 300 },
      ],
      remaining: 0,
    },
  );
});
test("FIFO exposes unapplied overpayment", () => {
  assert.equal(
    fifo(150, [{ id: "i", totalMinor: 100, paidMinor: 0 }]).remaining,
    50,
  );
});
test("credit includes committed orders and accepts exact boundary", () => {
  assert.equal(exceedsCredit(1000, 500, 200, 300), false);
  assert.equal(exceedsCredit(1000, 500, 200, 301), true);
});
test("incentive slabs match 80 100 and 120 percent fixtures", () => {
  assert.equal(calculateIncentive(79999, 100000, 0).incentiveMinor, 0);
  assert.equal(calculateIncentive(80000, 100000, 0).incentiveMinor, 800);
  assert.equal(calculateIncentive(100000, 100000, 0).incentiveMinor, 2000);
  assert.equal(
    calculateIncentive(120000, 100000, 2, 10000).incentiveMinor,
    4100,
  );
});
test("money rejects fractions and preserves proportional discounts", () => {
  assert.throws(() => safeMinor(1.5));
  assert.throws(() => safeMinor(-1));
  assert.equal(proportional(100, 250, 1000), 25);
});
