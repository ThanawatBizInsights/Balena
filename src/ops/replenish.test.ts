// Run with `npm test` (Node strips the types). ICONSIAM replenishment rules, hand-worked.
import assert from "node:assert/strict";
import { addDays, estimateDemand, outOfStockDays, plan, withDefaults, type PlanInput } from "./replenish.ts";

const near = (a: number | null, b: number, msg: string) => assert.ok(a != null && Math.abs(a - b) < 1e-6, `${msg}: ${a} ≠ ${b}`);
const today = "2026-10-29";
const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  today, onHand: 0, settings: null, dated: [], monthly: [], outOfStockDays: new Set(), inbound: [], ...over,
});
// 14 dated days with 28 units → 2 a day.
const twoPerDay = [{ start: addDays(today, -13), end: today, qty: 28 }];

// Example from the brief: demand 2/day, on hand 6, no inbound, 4-day lead time.
{
  const p = plan(base({ onHand: 6, dated: twoPerDay }));
  near(p.demand.daily, 2, "dated demand");
  assert.equal(p.demand.method, "dated");
  assert.equal(p.leadTime, 4);
  near(p.cover, 3, "cover");
  assert.equal(p.status, "stockout_risk", "3 days of cover < 4-day lead time");
  assert.equal(p.gap?.reason, "lead_time");
  assert.equal(p.gap?.days, 1);
  near(p.reorderPoint, 8, "reorder point 2 × 4");
  // Target 2 × (4 + 14) = 36; position 6 → 30.
  assert.equal(p.recommended, 30);
  assert.ok(p.targetCoverDefaulted);
}

// Transport time adds to preparation (never assumed inside it).
{
  const p = plan(base({ onHand: 40, dated: twoPerDay, settings: { transit_days: 2 } }));
  assert.equal(p.leadTime, 6);
  near(p.reorderPoint, 12, "2 × 6");
  // Position 40, ROP 12 → (40 − 12) / 2 = 14 days from today.
  assert.equal(p.prepDeadline, addDays(today, 14));
  assert.equal(p.status, "healthy");
}

// Prepare now / due soon around the deadline.
{
  assert.equal(plan(base({ onHand: 8, dated: twoPerDay })).status, "prepare_now", "position = ROP");
  assert.equal(plan(base({ onHand: 14, dated: twoPerDay })).status, "due_soon", "3 days to deadline");
  assert.equal(plan(base({ onHand: 20, dated: twoPerDay })).status, "healthy");
}

// A confirmed shipment that lands after the shelf is empty still shows the gap.
{
  const late = plan(base({ onHand: 6, dated: twoPerDay, inbound: [{ qty: 30, status: "dispatched", expected_arrival: addDays(today, 5), planned_dispatch: null, dispatched_on: today }] }));
  assert.equal(late.status, "stockout_risk");
  assert.equal(late.gap?.reason, "late_inbound");
  assert.equal(late.gap?.from, addDays(today, 3));
  assert.equal(late.gap?.days, 2);
  assert.equal(late.position, 36, "inbound counts in the position");
  const onTime = plan(base({ onHand: 6, dated: twoPerDay, inbound: [{ qty: 30, status: "dispatched", expected_arrival: addDays(today, 2), planned_dispatch: null, dispatched_on: today }] }));
  assert.equal(onTime.gap, null);
  // Planned (not dispatched) shipments are shown but not counted.
  const planned = plan(base({ onHand: 6, dated: twoPerDay, inbound: [{ qty: 30, status: "planned", expected_arrival: null, planned_dispatch: today, dispatched_on: null }] }));
  assert.equal(planned.position, 6);
  assert.equal(planned.plannedInbound, 30);
}

// Pack multiple, minimum shipment, verified shelf life.
{
  assert.equal(plan(base({ onHand: 6, dated: twoPerDay, settings: { pack_multiple: 12 } })).recommended, 36, "30 → 36");
  assert.equal(plan(base({ onHand: 34, dated: twoPerDay, settings: { min_shipment: 10 } })).recommended, 10, "2 → minimum 10");
  const capped = plan(base({ onHand: 6, dated: twoPerDay, settings: { shelf_life_days: 10, shelf_life_verified: true } }));
  assert.equal(capped.recommended, 14, "2 × 10 − 6");
  assert.ok(capped.shelfCapped);
  assert.equal(plan(base({ onHand: 6, dated: twoPerDay, settings: { shelf_life_days: 10 } })).shelfCapped, false, "unverified shelf life is ignored");
}

// Safety stock raises the reorder point and the target.
{
  const p = plan(base({ onHand: 20, dated: twoPerDay, settings: { safety_days: 3 } }));
  near(p.safetyStock, 6, "2 × 3");
  near(p.reorderPoint, 14, "8 + 6");
  near(p.targetStock, 42, "36 + 6");
}

// Missing reporting days are not zero sales; out-of-stock days are left out.
{
  // Two records with a reported gap between them: 10 units over 5 days + 10 units over 5 days.
  const d = estimateDemand(base({ dated: [
    { start: addDays(today, -20), end: addDays(today, -16), qty: 10 },
    { start: addDays(today, -4), end: today, qty: 10 },
  ] }), withDefaults(null));
  assert.equal(d.observedDays, 10, "the 11 unreported days don't count");
  near(d.daily, 2, "20 / 10");
  const oos = new Set([addDays(today, -1), today]);
  const e = estimateDemand(base({ dated: twoPerDay, outOfStockDays: oos }), withDefaults(null));
  assert.equal(e.observedDays, 12);
  assert.equal(e.excludedOutOfStock, 2);
  near(e.daily, 28 / 12, "empty-shelf days left out");
}

// Too little dated history → the monthly average, clearly labelled; nothing → insufficient data.
{
  const p = plan(base({ onHand: 10, dated: [{ start: addDays(today, -2), end: today, qty: 6 }], monthly: [{ month: "2026-08-01", qty: 31, days: 31 }] }));
  assert.equal(p.demand.method, "monthly");
  assert.equal(p.demand.confidence, "low");
  near(p.demand.daily, 1, "31 / 31");
  const none = plan(base({ onHand: 10 }));
  assert.equal(none.status, "insufficient_data");
  assert.equal(none.recommended, null, "no recommendation without demand");
  assert.equal(plan(base({ onHand: 10, dated: [{ start: addDays(today, -2), end: today, qty: 6 }], settings: { method: "dated" } })).status,
    "insufficient_data", "dated-only with 3 days");
}

// Manual target (new product) needs a value; zero demand is healthy with nothing to send.
{
  const m = plan(base({ onHand: 3, settings: { method: "manual", manual_daily: 1, manual_note: "New product, owner estimate" } }));
  assert.equal(m.demand.method, "manual");
  near(m.cover, 3, "3 / 1");
  assert.equal(m.status, "stockout_risk");
  const z = plan(base({ onHand: 5, dated: [{ start: addDays(today, -13), end: today, qty: 0 }] }));
  near(z.demand.daily, 0, "measured zero");
  assert.equal(z.status, "healthy");
  assert.equal(z.recommended, 0);
  assert.equal(z.cover, null, "no days-of-cover figure for zero demand");
}

// Negative or empty stock is out of stock; the recommendation still uses the measured demand.
{
  const p = plan(base({ onHand: -3, dated: twoPerDay }));
  assert.equal(p.status, "out_of_stock");
  assert.equal(p.sellable, 0);
  assert.equal(p.recommended, 36);
  assert.equal(plan(base({ onHand: 0 })).status, "out_of_stock", "empty with no history");
}

// Empty-shelf days from the stock ledger.
{
  const days = outOfStockDays("2026-10-10", 5, 0, [
    { date: "2026-10-01", qty: 3 }, { date: "2026-10-07", qty: -3 }, { date: "2026-10-09", qty: 2 },
  ]);
  assert.deepEqual([...days].sort(), ["2026-10-08", "2026-10-09"]);
}

// Before the store's first stock record nothing is known: those days are not "empty shelf" days.
// A day with recorded sales was never an empty-shelf day either.
{
  const days = outOfStockDays("2026-10-10", 10, 0, [{ date: "2026-10-05", qty: 4 }, { date: "2026-10-07", qty: -4 }]);
  assert.deepEqual([...days].sort(), ["2026-10-08", "2026-10-09", "2026-10-10"], "1-4 Oct untracked, 8-10 Oct empty");
  const sold = outOfStockDays("2026-10-10", 10, 0, [{ date: "2026-10-05", qty: 4 }, { date: "2026-10-07", qty: -4 }], new Set(["2026-10-09"]));
  assert.deepEqual([...sold].sort(), ["2026-10-08", "2026-10-10"]);
  // Sales recorded before tracking started still count, over all their days.
  const d = estimateDemand(base({ today: "2026-10-10", dated: [{ start: "2026-10-01", end: "2026-10-10", qty: 10 }],
    outOfStockDays: outOfStockDays("2026-10-10", 28, 0, [{ date: "2026-10-07", qty: 20 }]) }), withDefaults(null));
  assert.equal(d.observedDays, 10);
  near(d.daily, 1, "10 units over 10 reported days");
}

console.log("Replenishment rules: all checks passed.");
