// Translation check: every customer-facing text must exist in Thai and English.
//
//   npm run check:i18n        (also part of `npm test` and `npm run build`)
//
// Reports, by path, every key missing in one language, empty value, mismatched list length
// or {placeholder}, Thai text left in the English version, product/recipe text that lacks a
// language, and Thai text hard-coded in page components instead of the translation files.
// It checks structure, not wording, so editing copy never breaks it.
import { createServer } from "vite";
import { readFileSync, readdirSync } from "node:fs";

const THAI = /[฀-๿]/;
const problems = [];
const report = (where, msg) => problems.push(`${where}: ${msg}`);
const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");

/** Compares the th and en trees of a dictionary key by key. */
function compare(th, en, path) {
  if (typeof th === "string") {
    if (typeof en !== "string") return report(path, "missing in English");
    if (!th.trim()) report(path, "empty in Thai");
    if (!en.trim()) report(path, "empty in English");
    if (THAI.test(en)) report(path, `English text contains Thai: "${en}"`);
    if (placeholders(th) !== placeholders(en)) report(path, `placeholders differ (th {${placeholders(th)}} / en {${placeholders(en)}})`);
    return;
  }
  if (Array.isArray(th)) {
    if (!Array.isArray(en)) return report(path, "missing in English");
    if (th.length !== en.length) report(path, `list has ${th.length} Thai and ${en.length} English items`);
    th.forEach((v, i) => compare(v, en[i], `${path}[${i}]`));
    return;
  }
  for (const k of Object.keys(th)) {
    if (!(k in (en ?? {}))) report(`${path}.${k}`, "missing in English");
    else compare(th[k], en[k], `${path}.${k}`);
  }
  for (const k of Object.keys(en ?? {})) if (!(k in th)) report(`${path}.${k}`, "missing in Thai");
}

/** Finds every { th, en } pair inside data (products, recipes) and checks both are filled. */
function pairs(value, path) {
  if (Array.isArray(value)) return value.forEach((v, i) => pairs(v, `${path}[${i}]`));
  if (!value || typeof value !== "object") return;
  const keys = Object.keys(value);
  if (keys.includes("th") || keys.includes("en")) {
    if (typeof value.th !== "string" || !value.th.trim()) report(path, "Thai text missing");
    if (typeof value.en !== "string" || !value.en.trim()) report(path, "English text missing");
    else if (THAI.test(value.en)) report(path, `English text contains Thai: "${value.en}"`);
    return;
  }
  for (const k of keys) pairs(value[k], `${path}.${k}`);
}

const vite = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom", logLevel: "error" });
try {
  const load = (p) => vite.ssrLoadModule(p);
  const { shopText } = await load("/src/i18n/shop.ts");
  const { recipesPageText } = await load("/src/i18n/recipes-page.ts");
  const { products } = await load("/src/data/products.ts");
  const { recipeSource } = await load("/src/config/recipes.ts");

  compare(shopText.th, shopText.en, "src/i18n/shop.ts");
  compare(recipesPageText.th, recipesPageText.en, "src/i18n/recipes-page.ts");
  compare(recipeSource.scene.th, recipeSource.scene.en, "src/config/recipes.ts scene");

  // Products: these fields are required in both languages for every product.
  for (const p of products) {
    const where = `src/data/products.ts ${p.slug}`;
    for (const field of ["intro"]) if (!p[field]) report(where, `${field} missing`);
    p.images.forEach((img, i) => { if (!img.alt) report(`${where}.images[${i}]`, "alt text missing"); });
    pairs(p, where);
  }
  pairs(recipeSource.recipes, "src/config/recipes.ts recipes");
  pairs(recipeSource.starterNote, "src/config/recipes.ts STARTER_NOTE");
} finally {
  await vite.close();
}

// Hard-coded Thai in page components (comments and the language switch's own names excepted).
const allowed = ["ภาษาไทย"]; // the TH button names its language in that language
const devOnly = ["src/components/ConfigNotice.tsx"]; // staff-only notice, never in production
const files = [
  ...readdirSync("src/shop").filter((f) => f.endsWith(".tsx")).map((f) => `src/shop/${f}`),
  ...readdirSync("src/components").filter((f) => f.endsWith(".tsx")).map((f) => `src/components/${f}`),
  "src/App.tsx", "src/remotion/RecipeScene.tsx",
].filter((f) => !devOnly.includes(f));
for (const file of files) {
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "").replace(/^\s*\*.*$/, "");
    const cleaned = allowed.reduce((s, a) => s.replaceAll(a, ""), code);
    if (THAI.test(cleaned)) report(`${file}:${i + 1}`, `hard-coded Thai text; move it to src/i18n/: ${line.trim()}`);
  });
}

// Retired slogans must not come back (CLAUDE.md lists the approved ones).
const RETIRED = /big\s*whale\W*small\s*batch|everyday coffee,? made at home|วาฬตัวใหญ่ แต่/i;
const scan = [
  ...readdirSync("src/i18n").map((f) => `src/i18n/${f}`), "src/data/products.ts", "src/config/recipes.ts", ...files,
  "index.html", "products/index.html", "shop/index.html", "about/index.html", "404.html", "cold-brew-recipes/index.html",
];
for (const file of scan) {
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    if (RETIRED.test(line)) report(`${file}:${i + 1}`, `retired slogan; use "ชงง่ายที่บ้าน เข้มอร่อยได้ทุกเมนู" / "Your favorite coffee, made simple.": ${line.trim()}`);
  });
}

if (problems.length) {
  console.error(`Translation check failed (${problems.length}):\n` + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
console.log("Translations complete: Thai and English match for every page, product and recipe.");
