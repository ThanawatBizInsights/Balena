// Builds the Meta (Facebook/Instagram) catalog CSV from the site product data.
//
//   npm run catalog:meta                       # writes catalog/meta-catalog.csv
//   CATALOG_BASE=https://example.com npm run catalog:meta
//
// One row per product. Columns come from Meta's template (tools/catalog/meta-template.csv,
// both header rows kept). Nothing is guessed: prices aren't confirmed, so `price` stays
// blank, and every optional column we have no confirmed value for stays empty.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { factsOf, products } from "../../src/data/products.ts";
import { shopText } from "../../src/i18n/shop.ts";

const root = fileURLToPath(new URL("../../", import.meta.url));
const BASE = (process.env.CATALOG_BASE ?? "https://www.balenaroastery.com").replace(/\/$/, "");
const BRAND = "Balena Roastery";
const GOOGLE_CATEGORY = "Food, Beverages & Tobacco > Beverages > Coffee";

const [hints, header] = readFileSync(`${root}tools/catalog/meta-template.csv`, "utf8").trimEnd().split("\n");
const columns = header.split(",");

const cell = (v) => {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const rows = products.map((p) => {
  const facts = factsOf(p, "th").map((f) => `${shopText.th.catalog.facts[f.key]}: ${f.value}`).join(" | ");
  const row = {
    id: `${p.slug}-${p.sizeId}`,
    title: `${BRAND} ${p.name} ${p.subtitle.includes(p.size) ? p.subtitle : `${p.subtitle} ${p.size}`}`,
    description: `${p.intro.th} — ${facts}`,
    // Meta only accepts "in stock" / "out of stock". Stock isn't confirmed; see docs/STOREFRONT.md.
    availability: "in stock",
    condition: "new",
    link: `${BASE}/products?p=${p.slug}`, // the catalogue scrolls to the product itself
    image_link: `${BASE}/catalog/${p.slug}.jpg`,
    brand: BRAND,
    google_product_category: GOOGLE_CATEGORY,
    size: p.size,
    "product_tags[0]": p.category === "cold-brew" ? "Cold Brew" : "Coffee Beans",
  };
  for (const k of Object.keys(row)) if (!columns.includes(k)) throw new Error(`unknown column ${k}`);
  if (row.title.length > 200) throw new Error(`title too long: ${row.id}`);
  return columns.map((c) => cell(row[c])).join(",");
});

const ids = rows.map((r) => r.split(",")[0]);
if (new Set(ids).size !== ids.length) throw new Error("duplicate ids");

mkdirSync(`${root}catalog`, { recursive: true });
writeFileSync(`${root}catalog/meta-catalog.csv`, [hints, header, ...rows].join("\n") + "\n");
console.log(`catalog/meta-catalog.csv: ${rows.length} items (prices left blank until confirmed)`);
