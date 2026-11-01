// Renders inspection stills of a composition at the given frames (one bundle, one browser).
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
const [id, ...frames] = process.argv.slice(2);
const serveUrl = await bundle({ entryPoint: new URL("../src/index.ts", import.meta.url).pathname });
const opts = { serveUrl, browserExecutable: "/opt/pw-browsers/chromium", chromeMode: "chrome-for-testing" };
const composition = await selectComposition({ ...opts, id });
for (const f of frames) {
  await renderStill({ ...opts, composition, frame: Number(f), output: new URL(`../out/stills/${id.toLowerCase()}-${f}.png`, import.meta.url).pathname });
  process.stdout.write(`${f} `);
}
console.log("done");
