// Cost and profit maths for one Cold Brew product. Pure functions, no UI.

export type Unit = "batch" | "pouch" | "order" | "month";

/** Where a number came from, shown as a badge so estimates are never mistaken for facts. */
export type Source = "yours" | "estimate";

export type CostItem = {
  id: string;
  name: string;
  /** One line on why this cost is easy to forget. */
  why: string;
  unit: Unit;
  /** Quantity × price, e.g. 3 ลิตร × 1 บาท. When qtyLabel is absent, qty is 1. */
  qty: number;
  qtyLabel?: string;
  price: number;
  enabled: boolean;
  source: Source;
};

export type Inputs = {
  coffeeGrams: number;
  coffeePricePerKg: number;
  waterLiters: number;
  yieldLiters: number;
  pouchMl: number;
  /** Selling price of one pouch, in baht. */
  price: number;
  batchesPerMonth: number;
  pouchesPerOrder: number;
  /** Share of produced pouches never sold: tasting, spills, spoilage (0–0.9). */
  lossRate: number;
  /** Platform and payment fees as a share of the selling price (0–0.9). */
  feeRate: number;
  /** Concentrate per cup, used only for the cost-per-cup figure. */
  mlPerCup: number;
  items: CostItem[];
};

/** Segments of the cost of one sold pouch, in stacking order. */
export type SegmentId = "coffee" | "brewing" | "packaging" | "selling" | "fixed" | "waste";

export type Result = {
  pouchesPerBatch: number;
  leftoverMl: number;
  absorbedMl: number;
  ratio: number;
  coffeeCostPerBatch: number;
  batchItemsCost: number;
  producedPerMonth: number;
  soldPerMonth: number;
  segments: Record<SegmentId, number>;
  costPerPouch: number;
  variablePerPouch: number;
  profitPerPouch: number;
  margin: number;
  costPerCup: number;
  cupsPerPouch: number;
  monthly: { revenue: number; cost: number; profit: number; fixed: number };
  /** Pouches to sell each month to cover monthly costs; null when each sale loses money. */
  breakEvenPouches: number | null;
  /** Price that leaves the given profit margin after fees; null when unreachable. */
  priceForMargin: (margin: number) => number | null;
};

const sumFor = (items: CostItem[], unit: Unit) =>
  items.filter((i) => i.enabled && i.unit === unit).reduce((n, i) => n + itemCost(i), 0);

export function itemCost(item: CostItem): number {
  return Math.max(0, item.qty) * Math.max(0, item.price);
}

export function calculate(input: Inputs): Result {
  const yieldMl = Math.max(0, input.yieldLiters * 1000);
  const pouchMl = Math.max(1, input.pouchMl);
  const pouchesPerBatch = Math.floor(yieldMl / pouchMl);
  const leftoverMl = yieldMl - pouchesPerBatch * pouchMl;
  const absorbedMl = Math.max(0, input.waterLiters * 1000 - yieldMl);
  const ratio = input.coffeeGrams > 0 ? (input.waterLiters * 1000) / input.coffeeGrams : 0;

  const loss = clamp(input.lossRate, 0, 0.9);
  const fee = clamp(input.feeRate, 0, 0.9);
  const perBatch = pouchesPerBatch > 0 ? 1 / pouchesPerBatch : 0;

  const coffeeCostPerBatch = (input.coffeeGrams / 1000) * input.coffeePricePerKg;
  const batchItemsCost = sumFor(input.items, "batch");

  const producedPerMonth = pouchesPerBatch * Math.max(0, input.batchesPerMonth);
  const soldPerMonth = producedPerMonth * (1 - loss);
  const fixedPerMonth = sumFor(input.items, "month");

  // Costs per produced pouch; the share lost before sale is carried by the sold ones.
  const coffee = coffeeCostPerBatch * perBatch;
  const brewing = batchItemsCost * perBatch;
  const packaging = sumFor(input.items, "pouch");
  const waste = ((coffee + brewing + packaging) * loss) / (1 - loss);
  const selling = sumFor(input.items, "order") / Math.max(1, input.pouchesPerOrder) + input.price * fee;
  const fixed = soldPerMonth > 0 ? fixedPerMonth / soldPerMonth : 0;

  const segments = { coffee, brewing, packaging, selling, fixed, waste };
  const costPerPouch = coffee + brewing + packaging + selling + fixed + waste;
  const variablePerPouch = costPerPouch - fixed;
  const profitPerPouch = input.price - costPerPouch;
  const cupsPerPouch = input.mlPerCup > 0 ? pouchMl / input.mlPerCup : 0;

  const contribution = input.price - variablePerPouch;
  const costWithoutFee = costPerPouch - input.price * fee;

  return {
    pouchesPerBatch,
    leftoverMl,
    absorbedMl,
    ratio,
    coffeeCostPerBatch,
    batchItemsCost,
    producedPerMonth,
    soldPerMonth,
    segments,
    costPerPouch,
    variablePerPouch,
    profitPerPouch,
    margin: input.price > 0 ? profitPerPouch / input.price : 0,
    costPerCup: cupsPerPouch > 0 ? costPerPouch / cupsPerPouch : 0,
    cupsPerPouch,
    monthly: {
      revenue: input.price * soldPerMonth,
      cost: costPerPouch * soldPerMonth,
      profit: profitPerPouch * soldPerMonth,
      fixed: fixedPerMonth,
    },
    breakEvenPouches: contribution > 0 ? Math.ceil(fixedPerMonth / contribution) : null,
    // Fixed costs stay spread over this month's volume; price = cost / (1 − fee − margin).
    priceForMargin: (m) => {
      const room = 1 - fee - m;
      return room > 0 ? costWithoutFee / room : null;
    },
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
}
