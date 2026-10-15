// Run with `npm test` (Node strips the types). Checks the maths against hand-worked numbers.
import assert from "node:assert/strict";
import { calculate, type Inputs } from "./calc.ts";
import { defaults } from "./defaults.ts";

const near = (a: number, b: number, msg: string) => assert.ok(Math.abs(a - b) < 0.01, `${msg}: ${a} ≠ ${b}`);

// The owner's batch: 375 g coffee, 3 L water → 2.6 L → five 500 mL pouches + 100 mL.
const r = calculate(defaults);
assert.equal(r.pouchesPerBatch, 5);
near(r.leftoverMl, 100, "leftover");
near(r.absorbedMl, 400, "absorbed by grounds");
near(r.ratio, 8, "brew ratio");

// Per produced pouch: coffee 375 g × 600 ฿/kg = 225 ฿ ÷ 5 = 45.
near(r.segments.coffee, 45, "coffee");
// Batch items 3 + 10 + 5 + 75 = 93 ÷ 5 = 18.6.
near(r.segments.brewing, 18.6, "brewing");
// Pouch 7 + sticker 2 + date label 0.5 = 9.5.
near(r.segments.packaging, 9.5, "packaging");
// 5% never sold: (45 + 18.6 + 9.5) × 0.05 / 0.95.
near(r.segments.waste, (73.1 * 0.05) / 0.95, "waste");
// Ice pack 5 + cool bag 15 (shipping off) ÷ 2 pouches per order; no fee.
near(r.segments.selling, 10, "selling");
// Month 100 + 250 + 300 + 0 = 650 over 8 × 5 × 0.95 = 38 sold.
near(r.soldPerMonth, 38, "sold per month");
near(r.segments.fixed, 650 / 38, "fixed");

const total = 45 + 18.6 + 9.5 + (73.1 * 0.05) / 0.95 + 10 + 650 / 38;
near(r.costPerPouch, total, "cost per pouch");
near(r.profitPerPouch, 150 - total, "profit per pouch");
near(r.costPerCup, total / 10, "cost per cup");
near(r.monthly.profit, (150 - total) * 38, "monthly profit");

// Break-even: 650 ÷ (150 − variable) rounded up.
assert.equal(r.breakEvenPouches, Math.ceil(650 / (150 - (total - 650 / 38))));

// Price for a 40% margin leaves exactly 40% after costs.
const p = r.priceForMargin(0.4)!;
near((p - r.costPerPouch) / p, 0.4, "price for 40% margin (no fee)");

// With a 10% fee the target margin still holds at the suggested price.
const withFee: Inputs = { ...defaults, feeRate: 0.1 };
const rf = calculate(withFee);
const pf = rf.priceForMargin(0.3)!;
const rAtPf = calculate({ ...withFee, price: pf });
near(rAtPf.margin, 0.3, "price for 30% margin with 10% fee");

// A losing price has no break-even; a zero yield does not divide by zero.
assert.equal(calculate({ ...defaults, price: 20 }).breakEvenPouches, null);
const empty = calculate({ ...defaults, yieldLiters: 0 });
assert.equal(empty.pouchesPerBatch, 0);
assert.ok(Number.isFinite(empty.costPerPouch));

console.log("calc tests passed");
