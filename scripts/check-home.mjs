// Home page check at 390px and 1366px, Thai and English. Run against `npm run serve:dist`.
import { chromium } from "playwright";
import { existsSync, mkdirSync } from "node:fs";

const URL_ = process.env.HOME_URL ?? "http://localhost:4173/";
const exe = process.env.CHROMIUM_PATH ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
mkdirSync("screenshots", { recursive: true });
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const problems = [];
const ok = (c, m) => { if (!c) problems.push(m); console.log(`${c ? "ok  " : "FAIL"} ${m}`); };
const norm = (s) => s.replace(/ /g, " ");

for (const [label, viewport] of [["mobile", { width: 390, height: 844 }], ["desktop", { width: 1366, height: 900 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: label === "mobile" ? 2 : 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("response", (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()} ${r.url()}`));
  await page.goto(URL_, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  const h1 = async () => norm(await page.locator("h1").innerText());
  ok((await h1()).includes("กาแฟดี ๆ"), `[${label}] Thai by default: ${await h1()}`);
  ok((await page.evaluate(() => document.documentElement.lang)) === "th", `[${label}] html lang=th`);

  const broken = await page.evaluate(async () => {
    for (const i of document.images) { i.loading = "eager"; }
    await Promise.all([...document.images].map((i) => i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })));
    return [...document.images].filter((i) => i.naturalWidth === 0).map((i) => i.src);
  });
  ok(broken.length === 0, `[${label}] all ${await page.locator("img").count()} images load ${broken.join(", ")}`);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(overflow <= 0, `[${label}] no horizontal scroll (${overflow}px)`);

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `screenshots/home-${label}-th-first-screen.png` });
  await page.screenshot({ path: `screenshots/home-${label}-th-full.png`, fullPage: true });

  // Switch to English.
  await page.getByRole("button", { name: "EN" }).click();
  ok((await h1()).includes("Good coffee"), `[${label}] English after switch: ${await h1()}`);
  ok((await page.evaluate(() => document.documentElement.lang)) === "en", `[${label}] html lang=en`);
  ok((await page.title()).includes("Good Coffee"), `[${label}] English title`);
  await page.reload({ waitUntil: "networkidle" });
  ok((await h1()).includes("Good coffee"), `[${label}] English kept after reload`);
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const i of document.images) i.loading = "eager";
    await Promise.all([...document.images].map((i) => i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })));
  });
  await page.screenshot({ path: `screenshots/home-${label}-en-first-screen.png` });
  await page.screenshot({ path: `screenshots/home-${label}-en-full.png`, fullPage: true });
  const overflowEn = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(overflowEn <= 0, `[${label}] no horizontal scroll in English (${overflowEn}px)`);
  await page.getByRole("button", { name: "ไทย" }).click();
  ok((await h1()).includes("กาแฟดี ๆ"), `[${label}] back to Thai`);

  // Menu: phones open a menu; links reach their sections.
  if (label === "mobile") {
    await page.getByRole("button", { name: "เมนู" }).click();
    ok(await page.locator("#nav-links").isVisible(), `[${label}] menu opens`);
    await page.locator("#nav-links").getByRole("link", { name: "เมนูแนะนำ" }).click();
    await page.waitForTimeout(800);
    const top = await page.locator("#drinks").evaluate((el) => el.getBoundingClientRect().top);
    ok(Math.abs(top) < 60 && !(await page.locator("#nav-links").isVisible()), `[${label}] menu link scrolls to drinks and closes (${Math.round(top)})`);
  }
  await page.getByRole("link", { name: "ดูสินค้าของเรา" }).click();
  await page.waitForTimeout(800);
  const ptop = await page.locator("#products").evaluate((el) => el.getBoundingClientRect().top);
  ok(Math.abs(ptop) < 60, `[${label}] hero button scrolls to products (${Math.round(ptop)})`);

  // Unconfigured links: no dead links, shown as coming soon.
  const dead = await page.evaluate(() => [...document.querySelectorAll("a")].filter((a) => !a.getAttribute("href")).length);
  ok(dead === 0, `[${label}] no links without a destination`);
  ok((await page.locator(".channel.is-disabled").count()) === 4, `[${label}] 4 sales channels shown as coming soon`);

  const small = await page.evaluate(() =>
    [...document.querySelectorAll("a, button")].filter((el) => el.offsetParent && el.getBoundingClientRect().height < 40).map((el) => el.textContent.trim()),
  );
  ok(small.length === 0, `[${label}] tap targets ≥ 40px ${small.join(", ")}`);
  ok(errors.length === 0, `[${label}] no errors ${errors.join(" | ")}`);
  await ctx.close();
}

// Recipes link works from the home page.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto(URL_, { waitUntil: "networkidle" });
  await page.locator(".hero").getByRole("link", { name: "วิธีชง Cold Brew" }).last().click();
  await page.waitForLoadState("networkidle");
  ok(new URL(page.url()).pathname === "/cold-brew-recipes/", `recipes link opens ${new URL(page.url()).pathname}`);
  await ctx.close();
}

await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : "\nAll checks passed");
process.exit(problems.length ? 1 : 0);
