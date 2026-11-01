// Captures the real operations app (built site on :4173, `npm run serve:dist` in the repo root)
// with the demo dataset answering every database request. Nothing reaches Supabase.
// Writes public/shots/<scene>.png (2× / 3× resolution) and public/shots/boxes.json (element boxes
// in CSS pixels, used by the video for zooms, highlights and the cursor).
import { chromium } from "../../node_modules/playwright/index.mjs";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as D from "./demo-data.mjs";

const OUT = new URL("../public/shots/", import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const SITE = process.env.SITE ?? "http://localhost:4173";

const tables = {
  members: D.members, locations: D.locations, accounts: D.accounts, channels: D.channels, stock_items: D.items, settings: [], prices: D.prices,
  item_categories: D.categories, unit_conversions: [], documents: [...D.documents, ...D.moveDocs], doc_lines: D.docLines,
  stock_on_hand: D.stockOnHand, stock_moves: D.stockMoves, receivables: [], payables: [], audit_log: [], consignment_shipments: D.shipments,
  channel_item_maps: [], channel_profiles: [], periods: [],
};
const rpcs = {
  my_access: () => ({ member: true, owner: true }),
  overview_report: () => D.overview,
  consignment_sales: () => D.icsSales(),
  consignment_stock: () => D.icsStockData(),
  consignment_item_moves: () => D.icsMoves("BN-WHISKEY-100"),
};

// Just enough of PostgREST's filters for the app's queries.
const get = (row, key) => key.includes("->>") ? row[key.split("->>")[0]]?.[key.split("->>")[1]] ?? null : row[key];
function filter(rows, params) {
  for (const [k, v] of params) {
    if (["select", "order", "limit", "offset"].includes(k)) continue;
    const [op, ...rest] = v.split(".");
    const val = rest.join(".");
    rows = rows.filter((r) => {
      const x = get(r, k);
      switch (op) {
        case "eq": return String(x) === val;
        case "neq": return String(x) !== val;
        case "is": return val === "null" ? x == null : String(x) === val;
        case "in": return val.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/"/g, "")).includes(String(x));
        case "lt": return Number(x) < Number(val) || (x != null && String(x) < val && isNaN(Number(val)));
        case "lte": return String(x) <= val;
        case "gt": return Number(x) > Number(val);
        case "gte": return String(x) >= val;
        default: return true;
      }
    });
  }
  return rows;
}

const session = { access_token: "demo", refresh_token: "demo", token_type: "bearer", expires_in: 3600, expires_at: 4102444800,
  user: { id: D.USER, email: "demo@example.test", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-10-01T00:00:00Z" } };
const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "content-range" };

async function backend(route) {
  const req = route.request(), url = new URL(req.url()), p = url.pathname;
  if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
  const json = (body) => route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
  if (p.startsWith("/auth/v1/user")) return json(session.user);
  if (p.startsWith("/rest/v1/rpc/")) {
    const fn = rpcs[p.slice("/rest/v1/rpc/".length)];
    return fn ? json(fn()) : route.fulfill({ status: 400, headers: cors, contentType: "application/json", body: JSON.stringify({ message: "demo: not available" }) });
  }
  const t = p.replace("/rest/v1/", "");
  const rows = filter(tables[t] ?? [], url.searchParams);
  if (req.method() === "HEAD") return route.fulfill({ status: 200, headers: { ...cors, "content-range": `*/${rows.length}` } });
  if ((req.headers()["accept"] ?? "").includes("vnd.pgrst.object")) return json(rows[0] ?? null);
  return json(rows);
}

const DESKTOP = { width: 1440, height: 900, scale: 2 };
const MOBILE = { width: 390, height: 844, scale: 3 };
const scenes = [
  // name, hash, viewport, boxes to record, optional action
  ["d_overview", "#/", DESKTOP, [".statband", ".statband .dcard", ".dash__head", ".settle", ".alerts", ".dash__strip"]],
  ["d_stock", "#/stock", DESKTOP, [".filters", ".filters select", "table.table", "table.table tbody tr", ".warn"]],
  ["d_stock_beans", "#/stock", DESKTOP, [".filters", ".filters select", "table.table tbody tr"], async (page) => { await page.locator(".filters select").first().selectOption("FIN-BEANS"); }],
  ["d_moves", `#/moves/${D.item("BN-SANTOS-200").id}/BY`, DESKTOP, ["table.table", "table.table tbody tr", "h1"]],
  ["d_records", "#/records?type=production", DESKTOP, [".docs li", "h1"]],
  ["d_batch", `#/record/${D.BATCH}`, DESKTOP, [".facts", ".facts div", ".batch", ".batch .docs li", ".batch .btn--primary", "table.table tbody tr", "h1"]],
  ["d_ics_stock", "#/iconsiam?tab=stock", DESKTOP, [".statband", ".statband .kcard", ".callouts", ".callouts li", ".skus tbody tr", ".skus .pstatus", ".tabs .tab"]],
  ["d_ics_drawer", "#/iconsiam?tab=stock", DESKTOP, [".drawer", ".drawer .sflow", ".drawer .tl", ".drawer .calc", ".drawer .pstatus"], async (page) => {
    await page.locator(".skus tbody tr", { hasText: "Whiskey" }).getByRole("button").click(); await page.waitForTimeout(900);
  }, "viewport"],
  ["d_ship", `#/iconsiam/ship/${D.shipments[0].id}`, DESKTOP, [".shipsteps", ".shipsteps li", "table.table", ".ics__money", "h1"]],
  ["d_ics_sales", "#/iconsiam?tab=sales&prov=1", DESKTOP, [".chips", ".chips button", ".statband", ".statband .kcard", ".callouts", ".mbars", ".mbars__col", ".ibars", ".ics__table", ".sources", ".sources li", ".src", ".tabs .tab"]],
  ["m_overview", "#/", MOBILE, [".statband", ".statband .dcard", ".dash__head", ".settle", ".alerts"]],
  ["m_stock_beans", "#/stock", MOBILE, [".filters", "table.table tbody tr"], async (page) => { await page.locator(".filters select").first().selectOption("FIN-BEANS"); }],
  ["m_batch", `#/record/${D.BATCH}`, MOBILE, [".facts", ".batch", ".batch .btn--primary", "table.table"]],
  ["m_ics_stock", "#/iconsiam?tab=stock", MOBILE, [".statband", ".statband .kcard", ".callouts", ".callouts li", ".skus tbody tr", ".tabs"]],
  ["m_ics_drawer", "#/iconsiam?tab=stock", MOBILE, [".drawer", ".drawer .sflow", ".drawer .tl", ".drawer .calc"], async (page) => {
    await page.locator(".skus tbody tr", { hasText: "Whiskey" }).getByRole("button").click(); await page.waitForTimeout(900);
  }, "drawer"],
  ["m_ics_sales", "#/iconsiam?tab=sales&prov=1", MOBILE, [".chips", ".statband", ".statband .kcard", ".callouts", ".mbars", ".ibars", ".sources", ".src"]],
  ["m_ship", `#/iconsiam/ship/${D.shipments[0].id}`, MOBILE, [".shipsteps", "table.table", ".ics__money"]],
];

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const boxes = {};
const only = process.argv[2];
for (const [name, hash, vp, sels, action, mode] of scenes) {
  if (only && !name.startsWith(only)) continue;
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.scale, reducedMotion: "reduce", locale: "th-TH" });
  await ctx.addInitScript((s) => { localStorage.setItem("balena-lang", "th"); localStorage.setItem("sb-laxvaaqcnryzwvhcdsbl-auth-token", s); }, JSON.stringify(session));
  await ctx.route("https://laxvaaqcnryzwvhcdsbl.supabase.co/**", backend);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // A fixed "today" so dates, plans and countdowns match the demo month.
  await page.addInitScript(() => {
    const T = new Date("2026-10-29T10:00:00+07:00").getTime(), Real = Date, off = T - Real.now();
    // eslint-disable-next-line no-global-assign
    Date = class extends Real { constructor(...a) { super(...(a.length ? a : [Real.now() + off])); } static now() { return Real.now() + off; } };
  });
  await page.goto(`${SITE}/ops/${hash}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  if (action) await action(page);
  await page.waitForTimeout(500);
  if (mode !== "viewport" && mode !== "drawer") {
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } scrollTo(0, 0); });
    await page.waitForTimeout(400);
  }
  boxes[name] = { viewport: vp, page: await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.body.scrollHeight })), els: {} };
  for (const s of sels) {
    boxes[name].els[s] = await page.evaluate(([sel, drawer]) => [...document.querySelectorAll(sel)].map((e) => {
      const r = e.getBoundingClientRect();
      const top = drawer ? 0 : scrollY;
      return { x: Math.round(r.left), y: Math.round(r.top + top), w: Math.round(r.width), h: Math.round(r.height), text: (e.textContent ?? "").trim().slice(0, 60) };
    }), [s, mode === "drawer" || mode === "viewport"]);
  }
  if (mode === "drawer") {
    // The drawer scrolls on its own: capture its full height as one tall image.
    const dlg = page.locator(".drawer");
    const h = await dlg.evaluate((d) => d.scrollHeight);
    await page.setViewportSize({ width: vp.width, height: h });
    await page.waitForTimeout(300);
    boxes[name].page = { w: vp.width, h };
    for (const s of sels) boxes[name].els[s] = await page.evaluate((sel) => [...document.querySelectorAll(sel)].map((e) => {
      const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
    }), s);
    await page.screenshot({ path: `${OUT}${name}.png` });
  } else {
    if (mode === "viewport") boxes[name].page = { w: vp.width, h: vp.height };
    await page.screenshot({ path: `${OUT}${name}.png`, fullPage: mode !== "viewport" });
  }
  console.log(name, boxes[name].page, errors.join(" | "));
  await ctx.close();
}
await browser.close();
const prev = (() => { try { return JSON.parse(readFileSync(`${OUT}boxes.json`, "utf8")); } catch { return {}; } })();
writeFileSync(`${OUT}boxes.json`, JSON.stringify({ ...prev, ...boxes }, null, 1));
