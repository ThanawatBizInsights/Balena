// Builds the Meta (Facebook/Instagram) catalog CSV from the trial product data.
//
//   npm run catalog:meta                       # writes catalog/meta-catalog.csv
//   CATALOG_BASE=https://example.com npm run catalog:meta
//
// One row per variant. Columns come from Meta's template (tools/catalog/meta-template.csv,
// both header rows kept). Nothing is guessed: unconfirmed prices stay blank, and every
// optional column we have no confirmed value for stays empty.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { products } from "../../src/trial/data/products.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const BASE = (process.env.CATALOG_BASE ?? "https://balenaroastery.com").replace(/\/$/, "");
const BRAND = "Balena Roastery";
const GOOGLE_CATEGORY = "Food, Beverages & Tobacco > Beverages > Coffee";

const [hints, header] = readFileSync(`${root}tools/catalog/meta-template.csv`, "utf8").trimEnd().split("\n");
const columns = header.split(",");

const cell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const baht = (satang) => `${(satang / 100).toFixed(2)} THB`;

const rows = products.flatMap((p) => p.variants.map((v) => {
  const facts = p.attributes.filter((a) => a.value !== "ยังไม่ระบุ").map((a) => `${a.label}: ${a.value}`).join(" | ");
  const row = {
    id: `${p.slug}-${v.id}`,
    title: `${BRAND} ${p.name} ${p.subtitle.includes(v.label) ? p.subtitle : `${p.subtitle} ${v.label}`}`,
    description: `${p.description} — ${facts}`,
    availability: v.available ? "in stock" : "out of stock",
    condition: "new",
    link: `${BASE}/trial/products/${p.slug}`,
    image_link: `${BASE}/catalog/${p.slug}.jpg`,
    brand: BRAND,
    price: v.price == null ? "" : baht(v.price),
    google_product_category: GOOGLE_CATEGORY,
    item_group_id: p.variants.length > 1 ? p.slug : "",
    size: v.label,
    "product_tags[0]": p.category === "cold-brew" ? "Cold Brew" : "Coffee Beans",
  };
  for (const k of Object.keys(row)) if (!columns.includes(k)) throw new Error(`unknown column ${k}`);
  if (row.title.length > 200) throw new Error(`title too long: ${row.id}`);
  return columns.map((c) => cell(row[c])).join(",");
}));

const ids = rows.map((r) => r.split(",")[0]);
if (new Set(ids).size !== ids.length) throw new Error("duplicate ids");

mkdirSync(`${root}catalog`, { recursive: true });
writeFileSync(`${root}catalog/meta-catalog.csv`, [hints, header, ...rows].join("\n") + "\n");
const unpriced = products.flatMap((p) => p.variants).filter((v) => v.price == null).length;
console.log(`catalog/meta-catalog.csv: ${rows.length} items, ${unpriced} without a confirmed price (left blank)`);
