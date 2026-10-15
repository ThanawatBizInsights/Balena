// Builds one self-contained HTML file (data and photos inlined) for checking coffee details
// and prices. It is NOT part of the website build and is never deployed; send the file
// itself (LINE, email). Usage: node tools/price-check/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, "products.json"), "utf8"));
const images = Object.fromEntries(
  data.products.map((p) => [p.image, `data:image/webp;base64,${readFileSync(join(here, "images", p.image)).toString("base64")}`]),
);
const safe = (v) => JSON.stringify(v).replace(/</g, "\\u003c");
const html = readFileSync(join(here, "template.html"), "utf8")
  .replace("/*__DATA__*/null", safe({ products: data.products }))
  .replace("/*__IMAGES__*/{}", safe(images));
const out = join(here, "dist", "balena-price-check.html");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`wrote ${out} (${Math.round(html.length / 1024)} kB)`);

// The same page for a private claude.ai link: claude.ai supplies the outer document
// (doctype, charset, viewport), so keep only the title, styles, body and script.
const head = html.match(/<head>([\s\S]*)<\/head>/)[1]
  .replace(/<meta charset[^>]*>\s*/, "")
  .replace(/<meta name="viewport"[^>]*>\s*/, "");
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
const artifact = join(here, "dist", "balena-price-check.artifact.html");
writeFileSync(artifact, head.trim() + "\n" + body.trim() + "\n");
console.log(`wrote ${artifact}`);
