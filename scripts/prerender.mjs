// Renders the page to HTML at build time and writes it into dist/cold-brew-recipes/index.html.
// Runs after `vite build`; see the "build" script in package.json.
import { build } from "vite";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const outDir = resolve("node_modules/.cache/prerender");
await build({ logLevel: "warn", build: { ssr: "src/entry-server.tsx", outDir, emptyOutDir: true } });

const { render } = await import(pathToFileURL(resolve(outDir, "entry-server.js")).href);
const htmlPath = resolve("dist/cold-brew-recipes/index.html");
const html = readFileSync(htmlPath, "utf8");
const marker = '<div id="root"></div>';
if (!html.includes(marker)) throw new Error(`${htmlPath} has no empty #root to fill`);
const body = render();
if (!body.includes("ชงแก้วโปรด")) throw new Error("Pre-rendered HTML is missing the page heading");
writeFileSync(htmlPath, html.replace(marker, `<div id="root">${body}</div>`));
rmSync(outDir, { recursive: true, force: true });
console.log(`prerendered ${htmlPath} (${Math.round(body.length / 1024)} kB of HTML)`);
