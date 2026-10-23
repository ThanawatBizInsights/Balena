// Product data check: src/data/products.ts against the owner's positioning sheet
// (docs/content/coffee-positioning.csv).
//
//   npm run check:products        (also part of `npm test`)
//
// Checks that every CSV row maps to exactly one product (by name or a known spelling), sizes
// and statuses agree, planned products can't be bought, the existing addresses (slugs) and
// operations item codes are kept, and card copy stays short. Prints the mapping table.
import { readFileSync } from "node:fs";
import { allProducts, products, purchasable } from "../src/data/products.ts";
import { productLinks } from "../src/config/purchase-links.ts";

const problems = [];
const fail = (msg) => problems.push(msg);

/** Minimal CSV parser (quoted fields, commas and quotes inside quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim()));
}

const [, header, ...data] = parseCsv(readFileSync("docs/content/coffee-positioning.csv", "utf8"));
const col = (name) => header.findIndex((h) => h.startsWith(name));
const C = { category: col("Category"), product: col("Product"), status: col("Status"), size: col("Size") };

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
const index = new Map();
for (const p of allProducts) {
  for (const n of [p.internal.csvName, ...p.internal.aliases]) {
    const k = norm(n);
    if (index.has(k) && index.get(k) !== p) fail(`name "${n}" matches both ${index.get(k).slug} and ${p.slug}`);
    index.set(k, p);
  }
}

// The spellings the owner listed must resolve to the right product.
const VARIANTS = {
  "House Blends": "house-blends", "Lao Bolaven": "laos-bolaven", "Etiopia Gediyo": "ethiopia-gediyo",
  "Whisky": "whiskey", "52 Hz.": "52hz-signature-blend",
};
for (const [name, slug] of Object.entries(VARIANTS)) {
  if (index.get(norm(name))?.slug !== slug) fail(`"${name}" should map to ${slug}`);
}

const mapped = new Map();
const table = [];
for (const r of data) {
  const name = r[C.product].trim();
  const p = index.get(norm(name));
  if (!p) { fail(`CSV "${name}": no product`); continue; }
  if (mapped.has(p)) fail(`CSV "${name}" and "${mapped.get(p)}" both map to ${p.slug}`);
  mapped.set(p, name);
  const isCold = /cold brew/i.test(r[C.category]);
  if ((p.category === "cold-brew") !== isCold) fail(`${p.slug}: category differs from CSV (${r[C.category]})`);
  if (p.size !== r[C.size].trim()) fail(`${p.slug}: size ${p.size}, CSV ${r[C.size]}`);
  const status = r[C.status];
  const want = /^Planned/i.test(status) ? "planned" : /^Current/i.test(status) ? "available" : null;
  if (!want) fail(`${p.slug}: unknown CSV status "${status}"`);
  else if (p.status !== want) fail(`${p.slug}: status ${p.status}, CSV "${status}"`);
  table.push([name, p.slug, p.size, p.status + (p.published ? "" : " (unpublished)"), p.internal.opsCodes.join(" ") || "—"]);
}
for (const p of allProducts) if (!mapped.has(p)) fail(`${p.slug}: not in the CSV`);

// Existing addresses must keep working.
const KEPT = ["cold-brew-concentrate-smooth-black", "cold-brew-coffee-original", "brazil-santos", "brazil-cerrado",
  "laos-bolaven", "house-blends", "kenya-muranga", "milk-choc", "vino-rosso", "52hz-signature-blend", "blue-magic", "whiskey"];
for (const s of KEPT) if (!products.some((p) => p.slug === s)) fail(`existing address /products?p=${s} no longer resolves`);
const slugs = allProducts.map((p) => p.slug);
if (new Set(slugs).size !== slugs.length) fail("duplicate slugs");

// Operations items: one product per code; the 200 g Gediyo stays its own (historical) item.
const codes = allProducts.flatMap((p) => p.internal.opsCodes);
if (new Set(codes).size !== codes.length) fail("an operations item code is claimed by two products");
if (codes.includes("BN-GEDIYO-200")) fail("BN-GEDIYO-200 is the 200 g variant; it must not be mapped to the 100 g product");

for (const p of allProducts) {
  // Planned products: unpublished by default and never purchasable.
  if (p.status === "planned" && purchasable(p)) fail(`${p.slug}: planned but purchasable`);
  if (p.status === "planned" && p.published) console.warn(`note: ${p.slug} is planned and published (shown as Coming soon)`);
  // Card copy: one short line, at least one note, drinks present.
  for (const l of ["th", "en"]) if (p.benefit[l].length > 60) fail(`${p.slug}: benefit too long for a card (${l})`);
  if (!p.notes.length) fail(`${p.slug}: no tasting notes`);
  if (!p.drinks.length) fail(`${p.slug}: no recommended drinks`);
  // Batch-dependent products don't state process or roast as fact.
  if (p.batchDependent && (p.process || p.altitude || p.roast)) fail(`${p.slug}: batch-dependent but states process/roast`);
}
// Internal editorial phrases must not reach customer copy.
const INTERNAL = /social-media|conversation coffee|use current batch notes|final tasting copy|โซเชียล|บทสนทนา/i;
for (const p of allProducts) {
  const shown = JSON.stringify([p.benefit, p.story, p.notes, p.whoFor, p.drinks]);
  if (INTERNAL.test(shown)) fail(`${p.slug}: internal editorial wording in customer copy`);
}
// No product-specific purchase link may point at a planned product, or at a slug that doesn't exist.
for (const slug of Object.keys(productLinks)) {
  const p = allProducts.find((x) => x.slug === slug);
  if (!p) fail(`purchase-links.ts: productLinks["${slug}"] has no product`);
  else if (!purchasable(p)) fail(`purchase-links.ts: productLinks["${slug}"] is for a planned product`);
}

console.table(table.map(([csv, slug, size, status, ops]) => ({ csv, slug, size, status, ops })));
if (problems.length) {
  console.error(`Product check failed (${problems.length}):\n` + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log(`Products match the positioning sheet: ${data.length} rows, each mapped once (${products.length} shown on the site).`);
