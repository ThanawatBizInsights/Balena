// Checks the built price page in Chromium: layout at 390px and 1366px, maths, CSV and backup.
// Usage: node tools/price-check/build.mjs && node tools/price-check/check.mjs
import { chromium } from "playwright";
import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(join(here, "dist", "balena-price-check.html")).href;
const shots = join(here, "screenshots");
mkdirSync(shots, { recursive: true });
const exe = existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const problems = [];
const ok = (c, m) => { if (!c) problems.push(m); console.log(`${c ? "ok  " : "FAIL"} ${m}`); };

for (const [label, viewport] of [["mobile", { width: 390, height: 844 }], ["desktop", { width: 1366, height: 900 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: label === "mobile" ? 2 : 1, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);

  ok((await page.locator(".product").count()) === 10, `[${label}] 10 products`);
  const broken = await page.evaluate(async () => {
    for (const i of document.images) i.loading = "eager";
    await Promise.all([...document.images].map((i) => i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })));
    return [...document.images].filter((i) => !i.naturalWidth).length;
  });
  ok(broken === 0, `[${label}] all photos show`);
  const sizes = await page.locator(".head .pill").allInnerTexts();
  ok(sizes.filter((s) => s === "100 g").length === 2 && sizes.filter((s) => s === "200 g").length === 8, `[${label}] sizes 8×200 g, 2×100 g`);

  // Brazil Santos: Siam 350, online 390 → +11.4%; 10% fee + 20 baht pack & ship per order of 1 bag.
  await page.locator('[data-id="brazil-santos"][data-k="siam"]').fill("350");
  await page.locator('[data-id="brazil-santos"][data-k="online"]').fill("390");
  await page.locator('[data-set="feePct"]').fill("10");
  await page.locator('[data-set="packPerOrder"]').fill("20");
  const res = await page.locator('[data-result="brazil-santos"]').innerText();
  ok(res.includes("+11.4%"), `[${label}] difference +11.4%`);
  ok(res.includes("฿331"), `[${label}] online net 390 × 0.9 − 20 = ฿331`);
  ok(res.includes("฿411.11"), `[${label}] price that nets the Siam price (350 + 20) ÷ 0.9 = ฿411.11`);
  await page.locator('[data-set="rounding"]').selectOption("9");
  ok((await page.locator('[data-result="brazil-santos"]').innerText()).includes("฿419"), `[${label}] rounding up to …9 gives ฿419`);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(overflow <= 0, `[${label}] no page-wide horizontal scroll (${overflow}px)`);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(shots, `${label}-first-screen.png`) });
  await page.locator("#sum-title").scrollIntoViewIfNeeded();
  await page.locator(".tablewrap").screenshot({ path: join(shots, `${label}-summary.png`) });
  await page.screenshot({ path: join(shots, `${label}-full.png`), fullPage: true });

  // Saved on reload.
  await page.reload();
  ok((await page.locator('[data-id="brazil-santos"][data-k="siam"]').inputValue()) === "350", `[${label}] values kept after reload`);

  // CSV export.
  const [csv] = await Promise.all([page.waitForEvent("download"), page.locator("#csv").click()]);
  const text = readFileSync(await csv.path(), "utf8");
  ok(text.startsWith("﻿") && text.includes("Brazil Santos") && text.includes("11.43") && text.split("\r\n").length === 11, `[${label}] CSV has 10 rows and the difference`);

  // Backup out, reset, backup in.
  const [backup] = await Promise.all([page.waitForEvent("download"), page.locator("#save").click()]);
  const backupPath = await backup.path();
  page.once("dialog", (d) => d.accept());
  await page.locator("#reset").click();
  ok((await page.locator('[data-id="brazil-santos"][data-k="siam"]').inputValue()) === "", `[${label}] reset clears prices`);
  await page.locator("#load").setInputFiles(backupPath);
  await page.waitForTimeout(300);
  ok((await page.locator('[data-id="brazil-santos"][data-k="siam"]').inputValue()) === "350", `[${label}] backup restores prices`);

  ok(errors.length === 0, `[${label}] no errors ${errors.join(" | ")}`);
  await ctx.close();
}
await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : "\nAll checks passed");
process.exit(problems.length ? 1 : 0);
