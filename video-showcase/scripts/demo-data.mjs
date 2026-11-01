// Demo dataset for the showcase video (ข้อมูลตัวอย่าง / Demo data).
// Every quantity, amount, date and person here is fictional. Product, category, channel and
// branch names are the public catalogue and reference lists; nothing comes from real records.
// Served to the real operations app by scripts/capture.mjs (the production database is never touched).

const uid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const USER = uid(9001);
export const MEMBER = uid(9002);

export const members = [{ id: MEMBER, user_id: USER, email: "demo@example.test", display_name: "Demo", role: "owner", home_location: "BY", active: true }];
export const locations = [
  ["BY", "บางใหญ่", "Bang Yai", "own"], ["CK", "เจริญกรุง", "Charoen Krung", "own"],
  ["ICS", "ไอคอนสยาม", "ICONSIAM", "consignment"], ["TRANSIT", "ระหว่างขนส่ง", "In transit", "transit"],
].map(([code, name_th, name_en, kind]) => ({ code, name_th, name_en, kind, active: true }));
export const accounts = [{ code: "BANK-DEMO", name: "Demo account", holder: null, kind: "bank", active: true }];
export const channels = [
  ["SHOP-CK", "Charoen Krung shop", "shop"], ["SHOPEE", "Shopee", "online"], ["LINESHOP", "LINE SHOP", "online"],
  ["LAZADA", "Lazada", "online"], ["LINEOA", "LINE OA", "online"], ["FACEBOOK", "Facebook", "online"],
  ["GRAB", "Grab", "delivery"], ["ICONSIAM", "ICONSIAM", "consignment"],
].map(([code, name, kind]) => ({ code, name, kind, fee_percent: kind === "consignment" ? 25 : null, fee_confirmed: kind === "consignment", settles_days: null, active: true }));

export const categories = [
  ["RAW", null, "วัตถุดิบ", "Raw materials", "ingredient", 10], ["RAW-GREEN", "RAW", "สารกาแฟ (เมล็ดดิบ)", "Green coffee", "green_bean", 11],
  ["ROAST", null, "กาแฟคั่วสำหรับผลิต", "Roasted coffee inputs", "roasted_bean", 20], ["FIN", null, "สินค้าสำเร็จรูป", "Finished products", "product", 30],
  ["FIN-COLDBREW", "FIN", "Cold Brew", "Cold Brew", "product", 31], ["FIN-BEANS", "FIN", "เมล็ดกาแฟคั่ว (ถุงขาย)", "Roasted beans (retail bags)", "product", 32],
  ["PACK", null, "บรรจุภัณฑ์", "Packaging", "packaging", 40], ["CONS", null, "วัสดุสิ้นเปลือง", "Consumables", "consumable", 50],
].map(([code, parent_code, name_th, name_en, kind, sort]) => ({ code, parent_code, name_th, name_en, kind, product_group: null, system: true, sort, active: true }));

const P = [
  // code, th, en, kind, unit, category, size, sizeUnit, demo ICONSIAM price
  ["BN-52HZ-200", "52 Hz. Signature Blend 200 กรัม", "52 Hz. Signature Blend 200 g", "product", "pc", "FIN-BEANS", 200, "g", 420],
  ["BN-BLUEMAGIC-100", "Blue Magic 100 กรัม", "Blue Magic 100 g", "product", "pc", "FIN-BEANS", 100, "g", 430],
  ["BN-CERRADO-200", "Brazil Cerrado 200 กรัม", "Brazil Cerrado 200 g", "product", "pc", "FIN-BEANS", 200, "g", 400],
  ["BN-SANTOS-200", "Brazil Santos 200 กรัม", "Brazil Santos 200 g", "product", "pc", "FIN-BEANS", 200, "g", 400],
  ["BN-COLOMBIA-200", "Colombia Supremo 200 กรัม", "Colombia Supremo 200 g", "product", "pc", "FIN-BEANS", 200, "g", 450],
  ["BN-GEDIYO-200", "Etiopia Gediyo 200 กรัม", "Etiopia Gediyo 200 g", "product", "pc", "FIN-BEANS", 200, "g", 500],
  ["BN-FLORANGE-200", "Florange 200 กรัม", "Florange 200 g", "product", "pc", "FIN-BEANS", 200, "g", 400],
  ["BN-BOLAVEN-200", "Laos Bolaven 200 กรัม", "Laos Bolaven 200 g", "product", "pc", "FIN-BEANS", 200, "g", 420],
  ["BN-MILKCHOC-200", "Milk Choc 200 กรัม", "Milk Choc 200 g", "product", "pc", "FIN-BEANS", 200, "g", 400],
  ["BN-ROBUSTA-150", "Robusta 150 กรัม", "Robusta 150 g", "product", "pc", "FIN-BEANS", 150, "g", 300],
  ["BN-VINO-100", "Vino Rosso 100 กรัม", "Vino Rosso 100 g", "product", "pc", "FIN-BEANS", 100, "g", 450],
  ["BN-WHISKEY-100", "Whiskey 100 กรัม", "Whiskey 100 g", "product", "pc", "FIN-BEANS", 100, "g", 450],
  ["CB-ORIGINAL-500", "Cold Brew Coffee Original 500 มล.", "Cold Brew Coffee Original 500 mL", "product", "pc", "FIN-COLDBREW", 500, "mL", null],
  ["CB-SMOOTH-500", "Cold Brew Concentrate Smooth Black 500 มล.", "Cold Brew Concentrate Smooth Black 500 mL", "product", "pc", "FIN-COLDBREW", 500, "mL", null],
  ["CF-BEAN-SANTOS", "สารกาแฟ บราซิล ซานโตส", "Green Bean Brazil Santos", "green_bean", "g", "RAW-GREEN", null, null, null],
  ["PK-SPOUT-POUCH-500", "ถุงพวยสำหรับโคลด์บรูว์ 500 มล.", "Cold brew spout pouch 500 mL", "packaging", "pc", "PACK", null, null, null],
  ["PK-LABEL", "ฉลากสินค้า", "Product labels", "packaging", "pc", "PACK", null, null, null],
  ["PK-COFFEE-BAG", "ถุงกาแฟ", "Coffee bags", "packaging", "pc", "PACK", null, null, null],
];
export const items = P.map(([code, name_th, name_en, kind, base_unit, category_code, size_value, size_unit], i) => ({
  id: uid(100 + i), code, name_th, name_en, kind, base_unit, category: null, category_code, size_value, size_unit, pack: null,
  size_confirmed: true, iconsiam_code: null, barcode: null, min_level: kind === "product" ? 6 : null, active: true, version: 1, pack_note: null,
}));
export const item = (code) => items.find((i) => i.code === code);
export const prices = P.filter((p) => p[8]).map((p) => ({ id: uid(300 + P.indexOf(p)), item_id: item(p[0]).id, channel_code: "ICONSIAM",
  price: p[8], valid_from: "2026-08-01", valid_to: null, status: "approved", source: "demo" }));

// ---------- stock on hand (demo) ----------
const sRow = (code, loc, qty, avg_cost = null) => {
  const i = item(code);
  return { item_id: i.id, code, name_en: i.name_en, name_th: i.name_th, kind: i.kind, base_unit: i.base_unit, location_code: loc, qty,
    avg_cost, value: avg_cost != null && qty > 0 ? qty * avg_cost : null, min_level: i.min_level, negative: qty < 0, category_code: i.category_code };
};
export const stockOnHand = [
  sRow("CB-ORIGINAL-500", "CK", 18), sRow("CB-SMOOTH-500", "CK", -2), sRow("BN-SANTOS-200", "CK", 9), sRow("BN-GEDIYO-200", "CK", 7),
  sRow("BN-BLUEMAGIC-100", "CK", 11), sRow("BN-ROBUSTA-150", "CK", 5),
  sRow("BN-SANTOS-200", "BY", 24), sRow("BN-WHISKEY-100", "BY", 16), sRow("BN-VINO-100", "BY", 20), sRow("BN-COLOMBIA-200", "BY", 12),
  sRow("CF-BEAN-SANTOS", "BY", 18500, 0.42), sRow("PK-SPOUT-POUCH-500", "BY", 260, 6.5), sRow("PK-LABEL", "BY", 540, 1.2), sRow("PK-COFFEE-BAG", "BY", 310, 4),
];

// ---------- records: an output-first production batch (demo) ----------
const doc = (n, type, no, date, loc, data, extra = {}) => ({
  id: uid(n), doc_no: no, doc_type: type, doc_date: date, location_code: loc, status: "posted", total: null, data, note: null, attachments: [],
  needs_approval: false, approved_by: MEMBER, approved_at: `${date}T09:00:00Z`, decision_note: null, reverses_doc: null, reversed_by_doc: null,
  disputed: false, dispute_note: null, created_by: MEMBER, created_at: `${date}T09:00:00Z`, ...extra,
});
export const BATCH = uid(500);
export const documents = [
  doc(500, "production", "PRD-2026-00014", "2026-10-28", "CK", { kind: "brew", materials: "pending" }),
  doc(501, "consumption", "USE-2026-00031", "2026-10-28", "CK", { batch_id: BATCH }),
  doc(502, "production", "PRD-2026-00013", "2026-10-24", "CK", { kind: "brew", materials: "complete", cost_status: "unknown" }),
  doc(503, "production", "PRD-2026-00012", "2026-10-20", "BY", { kind: "pack", materials: "complete", cost_status: "provisional" }),
  doc(504, "transfer", "TRF-2026-00009", "2026-10-26", "BY", { to: "ICS", received_at: "2026-10-27", shipment_id: uid(700) }),
  doc(505, "sale", "SAL-2026-00061", "2026-10-29", "CK", { channel: "SHOP-CK", paid: "BANK-DEMO" }, { total: 1260 }),
  doc(506, "count", "CNT-2026-00004", "2026-10-25", "CK", {}),
];
export const docLines = [
  { id: uid(600), doc_id: BATCH, line_no: 1, item_id: item("CB-ORIGINAL-500").id, qty: 40, unit_price: null, amount: null, extra: { dir: "out" } },
  { id: uid(601), doc_id: uid(501), line_no: 1, item_id: item("PK-SPOUT-POUCH-500").id, qty: 40, unit_price: null, amount: null, extra: { dir: "in" } },
  { id: uid(602), doc_id: uid(501), line_no: 2, item_id: item("PK-LABEL").id, qty: 40, unit_price: null, amount: null, extra: { dir: "in" } },
];
export const stockMoves = [
  [710, "2026-10-01", 30, "opening", "opening", 9001], [711, "2026-10-06", -4, "sale", "sale", 9002], [712, "2026-10-12", -2, "sale", "sale", 9003],
  [713, "2026-10-18", 12, "production_out", "production", 9004], [714, "2026-10-26", -10, "transfer_out", "transfer", 504], [715, "2026-10-29", -2, "sale", "sale", 505],
].map(([id, move_date, qty, kind, doc_type, d]) => ({ id, move_date, qty, unit_cost: null, kind, doc_type, doc_id: uid(d), provisional: false,
  item_id: item("BN-SANTOS-200").id, location_code: "BY" }));
export const moveDocs = [[9001, "OPN-2026-00002"], [9002, "SAL-2026-00044"], [9003, "SAL-2026-00050"], [9004, "PRD-2026-00012"], [504, "TRF-2026-00009"], [505, "SAL-2026-00061"]]
  .map(([n, no]) => ({ id: uid(n), doc_no: no }));

// ---------- Overview and Business Report (demo month: October 2026) ----------
const byChannel = [
  ["ICONSIAM", 41, 18240, 4560, 0, 0, 13680, 0, 13680, 0], ["SHOP-CK", 52, 16120, 0, 0, 0, 0, 0, 0, 16120],
  ["SHOPEE", 23, 8650, 0, 0, 23, 0, 0, 0, 0], ["LINESHOP", 9, 3510, 0, 0, 9, 0, 0, 0, 3510],
].map(([channel, units, net, gp, fees, fees_unknown, due, received, open, paid_at_sale]) => ({ channel, units, net, gp, fees, fees_unknown, due, received, open, paid_at_sale }));
const byProduct = [["BN-GEDIYO-200", 22, 11000], ["CB-ORIGINAL-500", 31, 9610], ["BN-SANTOS-200", 19, 7600], ["BN-WHISKEY-100", 14, 6300], ["BN-BLUEMAGIC-100", 13, 5590], ["BN-ROBUSTA-150", 15, 4500]]
  .map(([code, units, net]) => ({ item_id: item(code).id, name_th: item(code).name_th, name_en: item(code).name_en, units, net }));
const net = byChannel.reduce((s, c) => s + c.net, 0);
export const overview = {
  from: "2026-10-01", to: "2026-10-31", location: null, has_records: true,
  units: byChannel.reduce((s, c) => s + c.units, 0), net_sales: net, gp: 4560, fees: 0, fees_unknown_orders: 32, after_channel: net - 4560,
  cash_received: 19630, cash_moves: 14, expenses: 6240, operating_expenses: 4890, advertising: 1350, expense_records: 9, purchases: 8400, purchase_records: 2,
  cogs: null, cogs_unknown_lines: 18, profit: null, profit_missing: ["costs"], profit_provisional: false,
  by_channel: byChannel, by_product: byProduct,
  receivable: { open: 13680, unconfirmed_count: 1, unconfirmed_amount: 13680 },
  attention: { batches_pending: 1, negative_stock: 1, opening_posted: false, stock_unreconciled: 0, pending_approvals: 2 },
  cash_balance: null, latest_sales_date: "2026-10-29",
  recent: documents.filter((d) => d.doc_type !== "consumption").map((d) => ({ id: d.id, doc_no: d.doc_no, doc_type: d.doc_type, doc_date: d.doc_date,
    created_at: d.created_at, status: d.status, total: d.total, location_code: d.location_code, channel: d.data.channel ?? null, supplier: null,
    category: null, materials: d.data.materials ?? null, reverses_doc: null })),
};

// ---------- ICONSIAM (demo): Aug and Sep official reports, Oct month-to-date ----------
const ICS_P = ["BN-GEDIYO-200", "BN-BLUEMAGIC-100", "BN-VINO-100", "BN-WHISKEY-100", "BN-SANTOS-200", "BN-ROBUSTA-150", "BN-52HZ-200", "BN-BOLAVEN-200", "BN-CERRADO-200", "BN-COLOMBIA-200", "BN-FLORANGE-200", "BN-MILKCHOC-200"];
const price = (code) => P.find((p) => p[0] === code)[8];
const qtys = { // demo units per month
  "2026-08": [9, 12, 10, 11, 14, 16, 5, 4, 6, 0, 3, 7], "2026-09": [14, 13, 12, 12, 13, 12, 7, 5, 6, 3, 2, 4], "2026-10": [20, 15, 16, 15, 13, 11, 8, 6, 6, 4, 2, 2],
};
const finalLines = (m) => ICS_P.map((c, i) => ({ c, q: qtys[m][i] })).filter((x) => x.q).map(({ c, q }) => {
  const n = q * price(c);
  return { item_id: item(c).id, final_qty: q, final_gross: n, final_discount: 0, final_net: n, final_gp: n * 0.25, final_payable: n * 0.75,
    prov_qty: 0, prov_net: 0, through: `${m}-${m.endsWith("08") ? 31 : 30}`, sources: [], excluded: [] };
});
const provLines = (m) => ICS_P.map((c, i) => ({ c, q: qtys[m][i] })).filter((x) => x.q).map(({ c, q }) => ({
  item_id: item(c).id, final_qty: 0, final_gross: null, final_discount: null, final_net: null, final_gp: null, final_payable: null,
  prov_qty: q, prov_net: q * price(c), through: `${m}-27`, sources: [], excluded: [] }));
const tot = (ls, k) => ls.reduce((s, l) => s + Number(l[k] ?? 0), 0);
const upd = (id, kind, status, version, cs, ce, asOf, ref, totals) => ({ id: uid(id), kind, version, status, coverage_start: cs, coverage_end: ce,
  as_of: asOf, source_ref: ref, source: {}, doc_id: kind === "final" ? uid(id + 50) : null, totals, created_at: `${asOf}T08:00:00Z` });
const aug = finalLines("2026-08"), sep = finalLines("2026-09"), oct = provLines("2026-10");
const month = (m, extra) => ({ month: `${m}-01`, state: "open", as_of: null, through: null, updates: [], items: [], received: 0, final_payable: 0, ...extra });
export function icsSales() {
  const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11"].map((m) => month(`2026-${m}`));
  months[7] = month("2026-08", { state: "finalised", as_of: "2026-09-05", through: "2026-08-31", items: aug, received: tot(aug, "final_payable"), final_payable: tot(aug, "final_payable"),
    updates: [upd(801, "final", "active", 1, "2026-08-01", "2026-08-31", "2026-09-05", "Official report · August (demo)", { units: tot(aug, "final_qty"), net: tot(aug, "final_net") })] });
  months[8] = month("2026-09", { state: "finalised", as_of: "2026-10-05", through: "2026-09-30", items: sep, received: 0, final_payable: tot(sep, "final_payable"),
    updates: [
      upd(811, "snapshot", "superseded", 1, "2026-09-01", "2026-09-14", "2026-09-14", "Month-to-date · 14 Sep (demo)", { units: 41, net: 16970 }),
      upd(812, "snapshot", "superseded", 1, "2026-09-01", "2026-09-27", "2026-09-27", "Month-to-date · 27 Sep (demo)", { units: 87, net: 35830 }),
      upd(813, "final", "active", 1, "2026-09-01", "2026-09-30", "2026-10-05", "Official report · September (demo)", { units: tot(sep, "final_qty"), net: tot(sep, "final_net") }),
    ] });
  months[9] = month("2026-10", { state: "provisional", as_of: "2026-10-27", through: "2026-10-27", items: oct,
    updates: [upd(821, "snapshot", "active", 1, "2026-10-01", "2026-10-27", "2026-10-27", "Month-to-date · 27 Oct (demo)", { units: tot(oct, "prov_qty"), net: tot(oct, "prov_net") })] });
  return { months: months.slice(0, 10), gp_percent: 25 };
}

// Stock at ICONSIAM on 27 Oct (demo): received 7 Oct, sold since.
const icsStock = { // code: [on hand 27 Oct, sold Oct]
  "BN-GEDIYO-200": [14, 20], "BN-BLUEMAGIC-100": [22, 15], "BN-VINO-100": [0, 16], "BN-WHISKEY-100": [2, 15], "BN-SANTOS-200": [4, 13],
  "BN-ROBUSTA-150": [9, 11], "BN-52HZ-200": [10, 8], "BN-BOLAVEN-200": [18, 6], "BN-CERRADO-200": [5, 6], "BN-COLOMBIA-200": [11, 4],
  "BN-FLORANGE-200": [10, 2], "BN-MILKCHOC-200": [6, 2],
};
const DAYS = Array.from({ length: 27 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
function spread(total, seed) { // the month's demo units over 27 days, deterministic
  const out = DAYS.map(() => 0);
  for (let k = 0; k < total; k++) out[(k * 7 + seed * 3 + Math.floor(k / 3)) % 27] += 1;
  return out;
}
export function icsStockData(today = "2026-10-29") {
  return {
    location: "ICS", month: "2026-10-01", today,
    state: { month: "2026-10-01", state: "provisional", as_of: "2026-10-27", through: "2026-10-27", received: 0, final_payable: 0,
      updates: icsSales().months[9].updates },
    items: ICS_P.map((code, n) => {
      const i = item(code), [left, sold] = icsStock[code], per = spread(sold, n);
      const after7 = per.slice(7).reduce((s, x) => s + x, 0), before = sold - after7, rec = left + after7;
      const daily = [{ date: "2026-10-07", qty: rec }, ...DAYS.slice(7).map((d, k) => ({ date: d, qty: -per[k + 7] })).filter((x) => x.qty)];
      const onHand = rec - after7;
      return {
        item_id: i.id, code, name_th: i.name_th, name_en: i.name_en, active: true, size_value: i.size_value, size_unit: i.size_unit, barcode: null, iconsiam_code: null,
        opening: 0, opening_confirmed: n !== 3, tracked: true,
        flows: { opening_recorded: rec, received: 0, sold: after7, returns: 0, removed: 0, damaged: 0, counted: 0, total: onHand },
        on_hand: onHand, daily, balance_before_window: 0,
        inbound: code === "BN-WHISKEY-100" ? [{ ship_no: "DN-2026-00003", shipment_id: uid(703), status: "planned", qty: 12, planned_dispatch: "2026-10-30", dispatched_on: null, expected_arrival: null }] : [],
        price: { price: price(code), source: "price_list", valid_from: "2026-08-01" }, form_price: null, settings: null,
        month_sales: { item_id: i.id, final_qty: 0, prov_qty: sold, prov_net: sold * price(code), final_net: null },
        dated_sales: DAYS.map((d, k) => ({ start: d, end: d, qty: per[k], kind: "interval" })),
        monthly_sales: [{ month: "2026-09-01", qty: qtys["2026-09"][n], days: 30 }],
        _before: before,
      };
    }),
  };
}
export const icsMoves = (code) => {
  const s = icsStockData().items.find((x) => x.code === code);
  let id = 1;
  return s.daily.map((d) => ({ id: id++, date: d.date, qty: d.qty, kind: d.qty > 0 ? "opening" : "sale", doc_type: d.qty > 0 ? "opening" : "sales_update",
    doc_id: uid(900), provisional: false, ref: d.qty > 0 ? "OPN-2026-00001" : `Daily sales · ${d.date}`, reason: null, shipment_id: null }));
};

export const shipments = [{
  id: uid(700), ship_no: "DN-2026-00002", channel_code: "ICONSIAM", location_code: "ICS", from_location: "BY", status: "received", doc_date: "2026-10-25",
  planned_dispatch: "2026-10-26", expected_arrival: "2026-10-27", dispatched_on: "2026-10-26", received_on: "2026-10-27", transfer_doc: uid(504), gp_percent: 25,
  signatures: { signed: true }, receipt_status: "confirmed", source: { type: "app" }, source_ref: null, note: null, receipt_note: null, created_at: "2026-10-25T03:00:00Z",
  consignment_shipment_lines: [["BN-SANTOS-200", 10, 400], ["BN-COLOMBIA-200", 6, 450], ["BN-ROBUSTA-150", 8, 300]].map(([c, q, p], k) => ({
    id: uid(710 + k), shipment_id: uid(700), line_no: k + 1, item_id: item(c).id, map_id: null, source_code: null, barcode: null, description: item(c).name_th,
    package_size: null, qty: q, unit_price: p, amount: q * p, accepted: q, rejected: 0, missing: 0 })),
}, {
  id: uid(703), ship_no: "DN-2026-00003", channel_code: "ICONSIAM", location_code: "ICS", from_location: "BY", status: "planned", doc_date: "2026-10-29",
  planned_dispatch: "2026-10-30", expected_arrival: "2026-10-31", dispatched_on: null, received_on: null, transfer_doc: null, gp_percent: 25,
  signatures: {}, receipt_status: "not_received", source: { type: "app" }, source_ref: null, note: null, receipt_note: null, created_at: "2026-10-29T03:00:00Z",
  consignment_shipment_lines: [["BN-WHISKEY-100", 12, 450], ["BN-VINO-100", 20, 450]].map(([c, q, p], k) => ({
    id: uid(720 + k), shipment_id: uid(703), line_no: k + 1, item_id: item(c).id, map_id: null, source_code: null, barcode: null, description: item(c).name_th,
    package_size: null, qty: q, unit_price: p, amount: q * p, accepted: null, rejected: null, missing: null })),
}];
