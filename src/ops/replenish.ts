// ICONSIAM replenishment maths (pure; tested in replenish.test.ts).
//
// Demand comes only from recorded sales:
// - "dated": interval updates and the increase between month-to-date snapshots, over the days they
//   cover inside the window. Days the shelf was empty are left out; days nobody reported are not
//   counted as zero.
// - "monthly": official monthly totals ÷ days in those months. Labelled as a monthly average,
//   never shown as a daily trend.
// - "manual": a target the owner typed, with a reason (new products, too little history).
// With none of these, the result is "insufficient data", never a guess.
//
// Planning (all in calendar days):
//   lead time         = preparation (default 4) + transport/receiving (if set)
//   days of cover     = sellable on hand ÷ daily demand
//   reorder point     = daily demand × lead time + safety stock
//   inventory position= sellable on hand + confirmed inbound (dispatched) − reserved (none tracked)
//   target stock      = daily demand × (lead time + target cover) + safety stock
//   recommended       = max(0, target − position), at least the minimum shipment, rounded up to the
//                       pack multiple, capped by a verified shelf life
// A dispatched shipment that arrives after the shelf runs empty doesn't hide the gap.

export type PlanMethod = "auto" | "dated" | "monthly" | "manual";
export type PlanStatus = "out_of_stock" | "insufficient_data" | "stockout_risk" | "prepare_now" | "due_soon" | "healthy";

export interface PlanSettings {
  prep_days: number;
  transit_days: number | null;
  safety_days: number | null;
  target_cover_days: number | null;
  pack_multiple: number;
  min_shipment: number;
  shelf_life_days: number | null;
  shelf_life_verified: boolean;
  window_days: number;
  method: PlanMethod;
  manual_daily: number | null;
  manual_note: string | null;
}

export const DEFAULT_SETTINGS: PlanSettings = {
  prep_days: 4, transit_days: null, safety_days: null, target_cover_days: null, pack_multiple: 1, min_shipment: 0,
  shelf_life_days: null, shelf_life_verified: false, window_days: 28, method: "auto", manual_daily: null, manual_note: null,
};
/** Used when no target cover is set; always shown as a default the owner can change. */
export const DEFAULT_TARGET_COVER = 14;
/** Fewer observed days than this is not enough for a dated estimate. */
export const MIN_OBSERVED_DAYS = 7;
/** "Due soon" when the preparation deadline is this close. */
export const DUE_SOON_DAYS = 3;

export interface DatedSale { start: string; end: string; qty: number }
export interface MonthlySale { month: string; qty: number; days: number }
export interface Inbound { qty: number; status: "planned" | "dispatched"; expected_arrival: string | null; planned_dispatch: string | null; dispatched_on: string | null; ship_no?: string }

export interface PlanInput {
  today: string;
  onHand: number;
  settings: Partial<PlanSettings> | null;
  dated: DatedSale[];
  monthly: MonthlySale[];
  /** Dates (YYYY-MM-DD) the shelf was empty at the start of the day. */
  outOfStockDays: Set<string>;
  inbound: Inbound[];
}

export interface Demand {
  daily: number | null;
  method: "dated" | "monthly" | "manual" | "none";
  units: number;
  observedDays: number;
  from: string | null;
  to: string | null;
  confidence: "high" | "medium" | "low" | "none";
  excludedOutOfStock: number;
}

export interface Plan {
  status: PlanStatus;
  demand: Demand;
  settings: PlanSettings;
  leadTime: number;
  transitSet: boolean;
  targetCoverDefaulted: boolean;
  sellable: number;
  cover: number | null;
  stockoutDate: string | null;
  safetyStock: number | null;
  reorderPoint: number | null;
  confirmedInbound: number;
  plannedInbound: number;
  position: number;
  targetStock: number | null;
  recommended: number | null;
  shelfCapped: boolean;
  prepDeadline: string | null;
  arrivalIfToday: string;
  /** A stretch with an empty shelf before stock can arrive. */
  gap: { from: string; to: string; days: number; reason: "lead_time" | "late_inbound" } | null;
}

const DAY = 86_400_000;
export const toDate = (s: string) => new Date(`${s}T00:00:00Z`);
export const iso = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => iso(new Date(toDate(s).getTime() + n * DAY));
export const daysBetween = (a: string, b: string) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY);

export function withDefaults(s: Partial<PlanSettings> | null | undefined): PlanSettings {
  const out = { ...DEFAULT_SETTINGS };
  for (const [k, v] of Object.entries(s ?? {})) if (k in out && v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}

/** Average daily demand from what was actually recorded. */
export function estimateDemand(input: PlanInput, settings: PlanSettings): Demand {
  const none: Demand = { daily: null, method: "none", units: 0, observedDays: 0, from: null, to: null, confidence: "none", excludedOutOfStock: 0 };
  if (settings.method === "manual") {
    return settings.manual_daily != null && settings.manual_daily >= 0
      ? { ...none, daily: settings.manual_daily, method: "manual", confidence: "low" }
      : none;
  }
  if (settings.method !== "monthly") {
    const from = addDays(input.today, -(settings.window_days - 1));
    const covered = new Set<string>();
    let units = 0;
    let oos = 0;
    for (const s of input.dated) {
      const len = daysBetween(s.start, s.end) + 1;
      if (len <= 0) continue;
      const a = s.start > from ? s.start : from;
      const b = s.end < input.today ? s.end : input.today;
      const inside = daysBetween(a, b) + 1;
      if (inside <= 0) continue;
      // A record that starts before the window counts in proportion to its days inside it.
      units += s.qty * (inside / len);
      for (let d = a; d <= b; d = addDays(d, 1)) covered.add(d);
    }
    for (const d of covered) if (input.outOfStockDays.has(d)) { covered.delete(d); oos++; }
    const days = covered.size;
    if (days >= MIN_OBSERVED_DAYS) {
      const sorted = [...covered].sort();
      return {
        daily: units / days, method: "dated", units, observedDays: days, from: sorted[0], to: sorted[sorted.length - 1],
        confidence: days >= 21 ? "high" : "medium", excludedOutOfStock: oos,
      };
    }
    if (settings.method === "dated") return { ...none, units, observedDays: days, excludedOutOfStock: oos };
  }
  // Monthly average from the latest official months (up to three).
  const months = [...input.monthly].sort((a, b) => b.month.localeCompare(a.month)).slice(0, 3);
  if (!months.length) return none;
  const units = months.reduce((s, m) => s + m.qty, 0);
  const days = months.reduce((s, m) => s + m.days, 0);
  const sorted = months.map((m) => m.month).sort();
  return { daily: units / days, method: "monthly", units, observedDays: days, from: sorted[0], to: sorted[sorted.length - 1], confidence: "low", excludedOutOfStock: 0 };
}

const roundUp = (n: number, multiple: number) => Math.ceil(n / multiple - 1e-9) * multiple;

export function plan(input: PlanInput): Plan {
  const settings = withDefaults(input.settings);
  const demand = estimateDemand(input, settings);
  const d = demand.daily;
  const leadTime = settings.prep_days + (settings.transit_days ?? 0);
  const targetCover = settings.target_cover_days ?? DEFAULT_TARGET_COVER;
  const sellable = Math.max(0, input.onHand);
  const dispatched = input.inbound.filter((i) => i.status === "dispatched");
  const confirmedInbound = dispatched.reduce((s, i) => s + i.qty, 0);
  const plannedInbound = input.inbound.filter((i) => i.status === "planned").reduce((s, i) => s + i.qty, 0);
  const position = sellable + confirmedInbound;
  const arrivalIfToday = addDays(input.today, leadTime);

  const base: Plan = {
    status: "insufficient_data", demand, settings, leadTime, transitSet: settings.transit_days != null,
    targetCoverDefaulted: settings.target_cover_days == null, sellable, cover: null, stockoutDate: null,
    safetyStock: null, reorderPoint: null, confirmedInbound, plannedInbound, position, targetStock: null,
    recommended: null, shelfCapped: false, prepDeadline: null, arrivalIfToday, gap: null,
  };

  if (d == null) return { ...base, status: sellable <= 0 ? "out_of_stock" : "insufficient_data" };

  const safetyStock = d * (settings.safety_days ?? 0);
  const reorderPoint = d * leadTime + safetyStock;
  const targetStock = d * (leadTime + targetCover) + safetyStock;
  let recommended = Math.max(0, targetStock - position);
  let shelfCapped = false;
  if (recommended > 0) {
    recommended = Math.max(recommended, settings.min_shipment);
    recommended = roundUp(recommended, settings.pack_multiple);
    if (settings.shelf_life_verified && settings.shelf_life_days) {
      // Never send more than can sell within the verified shelf life.
      const cap = Math.max(0, Math.floor(d * settings.shelf_life_days - position));
      if (recommended > cap) { recommended = Math.floor(cap / settings.pack_multiple) * settings.pack_multiple; shelfCapped = true; }
    }
  }
  const out: Plan = { ...base, safetyStock, reorderPoint, targetStock, recommended, shelfCapped };

  if (d === 0) {
    return { ...out, status: sellable <= 0 ? "out_of_stock" : "healthy", cover: null, recommended: 0 };
  }

  const cover = sellable / d;
  const stockoutDate = addDays(input.today, Math.floor(cover));
  // When does the inventory position fall to the reorder point? That is the last day to start.
  const prepDeadline = addDays(input.today, Math.floor((position - reorderPoint) / d));

  // Walk forward through dispatched arrivals: an arrival after the shelf is empty leaves a gap.
  let gap: Plan["gap"] = null;
  let stock = sellable;
  let day = input.today;
  const arrivals = dispatched
    .map((i) => ({ qty: i.qty, date: i.expected_arrival ?? addDays(i.dispatched_on ?? input.today, settings.transit_days ?? 0) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const a of arrivals) {
    const empty = addDays(day, Math.floor(stock / d));
    if (empty < a.date && !gap) gap = { from: empty, to: a.date, days: daysBetween(empty, a.date), reason: "late_inbound" };
    stock = Math.max(0, stock - d * Math.max(0, daysBetween(day, a.date))) + a.qty;
    day = a.date > day ? a.date : day;
  }
  // No confirmed shipment arrives in time and even starting today is too late.
  if (!gap && !arrivals.length && cover < leadTime) {
    gap = { from: stockoutDate, to: arrivalIfToday, days: daysBetween(stockoutDate, arrivalIfToday), reason: "lead_time" };
  }

  let status: PlanStatus;
  if (sellable <= 0) status = "out_of_stock";
  else if (gap && gap.days > 0) status = "stockout_risk";
  else if (prepDeadline <= input.today) status = "prepare_now";
  else if (daysBetween(input.today, prepDeadline) <= DUE_SOON_DAYS) status = "due_soon";
  else status = "healthy";

  return { ...out, status, cover, stockoutDate, prepDeadline, gap };
}

/** Days the shelf was empty at the start of the day, from the daily stock changes. */
export function outOfStockDays(today: string, windowDays: number, balanceBefore: number, daily: { date: string; qty: number }[]) {
  const from = addDays(today, -(windowDays - 1));
  const byDate = new Map(daily.map((x) => [x.date, Number(x.qty)]));
  let bal = balanceBefore;
  // Bring the balance up to the start of the window.
  for (const x of daily) if (x.date < from) bal += Number(x.qty);
  const out = new Set<string>();
  for (let d = from; d <= today; d = addDays(d, 1)) {
    if (bal <= 0) out.add(d);
    bal += byDate.get(d) ?? 0;
  }
  return out;
}
