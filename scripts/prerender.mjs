// Renders pages to HTML at build time and writes it into their built index.html, so the
// text shows before (or without) JavaScript. Runs after `vite build`; see package.json.
import { build } from "vite";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const pages = [
  { entry: "src/shop/entry-server.tsx", arg: "home", html: "dist/index.html", mustContain: "ชงง่ายที่บ้าน" },
  { entry: "src/shop/entry-server.tsx", arg: "products", html: "dist/products/index.html", mustContain: "Brazil Santos" },
  { entry: "src/shop/entry-server.tsx", arg: "about", html: "dist/about/index.html", mustContain: "ทำไมต้องวาฬ" },
  { entry: "src/entry-server.tsx", html: "dist/cold-brew-recipes/index.html", mustContain: "ชงแก้วโปรด" },
];

for (const page of pages) {
  const outDir = resolve("node_modules/.cache/prerender");
  await build({ logLevel: "warn", build: { ssr: page.entry, outDir, emptyOutDir: true } });
  const file = page.entry.split("/").pop().replace(/\.tsx$/, ".js");
  const { render } = await import(pathToFileURL(resolve(outDir, file)).href + `?t=${Date.now()}`);

  const htmlPath = resolve(page.html);
  const html = readFileSync(htmlPath, "utf8");
  const marker = /(<div id="root"[^>]*>)(<\/div>)/;
  if (!marker.test(html)) throw new Error(`${htmlPath} has no empty #root to fill`);
  const body = render(page.arg);
  if (!body.includes(page.mustContain)) throw new Error(`Pre-rendered ${page.html} is missing "${page.mustContain}"`);
  writeFileSync(htmlPath, html.replace(marker, (_, open, close) => open + body + close));
  rmSync(outDir, { recursive: true, force: true });
  console.log(`prerendered ${page.html} (${Math.round(body.length / 1024)} kB of HTML)`);
}
