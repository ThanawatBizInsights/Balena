// Page check: builds are served with `vite preview`, then this script opens the page in
// Chromium at phone and desktop sizes and checks text, layout, buttons and the player.
// Usage: npm run build && node scripts/serve-dist.mjs 4173 & npm run check:page
// (PAGE_URL can point at a deployed copy instead.)
import { chromium } from "playwright";
import { mkdirSync, existsSync } from "node:fs";

const BASE = process.env.PAGE_URL ?? "http://localhost:4173/cold-brew-recipes/";
const ORIGIN = new URL(BASE).origin;
const OUT = "screenshots";
mkdirSync(OUT, { recursive: true });
const exe = process.env.CHROMIUM_PATH ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const problems = [];
const ok = (cond, msg) => { if (!cond) problems.push(msg); console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); };

const expectText = [
  "ชงแก้วโปรดง่าย ๆ กับ Balena",
  "Cold Brew Concentrate สูตร Original ผสมได้หลายเมนู ปรับความเข้มได้ตามใจ",
  "เลือกเมนูที่อยากลอง",
  "สูตรเริ่มต้นสำหรับทดลองชง สามารถปรับสัดส่วนตามรสชาติที่ชอบ",
  "ชอบเข้มหรือเบา ปรับได้",
  "เริ่มจากสูตรแนะนำแล้วชิม หากเข้มไปให้เติมน้ำหรือนมทีละน้อย หากอ่อนไปให้เพิ่ม Cold Brew ทีละน้อย",
  "เก็บอย่างไร",
  "เก็บในตู้เย็น ปิดฝาให้สนิทหลังใช้ และตรวจสอบวันหมดอายุบนบรรจุภัณฑ์",
  "สั่งซื้อ Balena Cold Brew",
  "สอบถามวิธีชง",
];

const recipes = {
  "กาแฟดำเย็น": ["Balena Cold Brew", "50 มล.", "น้ำเย็น", "100 มล.", "น้ำแข็ง", "ใส่น้ำแข็ง", "เติม Cold Brew และน้ำเย็น", "คนให้เข้ากัน"],
  "กาแฟนมเย็น": ["นมสดหรือนมพืช", "100 มล.", "น้ำเชื่อม", "ตามชอบ ไม่จำเป็นต้องเติม", "ใส่น้ำแข็งและนม", "เติม Cold Brew", "คนให้เข้ากันและปรับความหวานตามชอบ"],
  "กาแฟโซดา": ["โซดาเย็น", "100 มล.", "เติมโซดาช้า ๆ และคนเบา ๆ"],
  "กาแฟส้ม": ["น้ำส้ม", "100 มล.", "เติมน้ำส้ม", "ค่อย ๆ เติม Cold Brew และคนก่อนดื่ม"],
};

for (const [label, viewport] of [["mobile", { width: 390, height: 844 }], ["desktop", { width: 1366, height: 900 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: label === "mobile" ? 2 : 1, hasTouch: label === "mobile" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
  page.on("requestfailed", (r) => errors.push(`request failed: ${r.url()}`));
  page.on("response", (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()}: ${r.url()}`));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  const body = (await page.locator("body").innerText()).replace(/\u00A0/g, " ");
  for (const t of expectText) ok(body.includes(t), `[${label}] text: ${t}`);

  // Remotion must not load before the animation slot is near the screen.
  const early = await page.evaluate(() => performance.getEntriesByType("resource").some((r) => r.name.includes("PlayerPanel")));
  ok(label === "desktop" || !early, `[${label}] player bundle is lazy (loaded before scroll: ${early})`);

  const brokenImages = await page.evaluate(() =>
    [...document.images].filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src),
  );
  ok(brokenImages.length === 0, `[${label}] all images load ${brokenImages.join(", ")}`);

  await page.screenshot({ path: `${OUT}/${label}-first-screen.png` });
  await page.screenshot({ path: `${OUT}/${label}-full.png`, fullPage: true });

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(overflow <= 0, `[${label}] no horizontal scroll (overflow ${overflow}px)`);

  // Hero button scrolls to recipes.
  await page.getByRole("link", { name: "เลือกเมนูที่อยากลอง" }).click();
  await page.waitForTimeout(900);
  const top = await page.locator("#recipes").evaluate((el) => el.getBoundingClientRect().top);
  ok(Math.abs(top) < 40, `[${label}] hero button scrolls to recipes (top ${Math.round(top)})`);

  for (const [name, items] of Object.entries(recipes)) {
    await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
    await page.waitForTimeout(300);
    const detail = await page.locator("#recipe-detail").innerText();
    ok(detail.includes(name) && items.every((i) => detail.includes(i)), `[${label}] ${name}: ingredients and steps`);
    ok((await page.locator("#recipe-detail .steps li").count()) === 3, `[${label}] ${name}: three steps`);
    ok(await page.getByRole("button", { name: new RegExp(`^${name}`) }).getAttribute("aria-pressed") === "true", `[${label}] ${name}: card selected`);
  }

  // Footer buttons: disabled while their URLs are empty.
  for (const n of ["สั่งซื้อ Balena Cold Brew", "สอบถามวิธีชง"]) {
    const link = page.getByRole("link", { name: n });
    if (await link.count()) ok((await link.getAttribute("href"))?.startsWith("http"), `[${label}] ${n} has a URL`);
    else ok(await page.getByRole("button", { name: n }).isDisabled(), `[${label}] ${n} disabled (no URL configured)`);
  }

  // Touch targets.
  const small = await page.evaluate(() =>
    [...document.querySelectorAll("main button, main a, footer button, footer a")]
      .filter((el) => el.offsetParent && !el.closest(".__remotion-player"))
      .filter((el) => { const r = el.getBoundingClientRect(); return r.height < 44; })
      .map((el) => el.textContent.trim()),
  );
  ok(small.length === 0, `[${label}] touch targets ≥ 44px (${small.join(", ")})`);

  // Player: not autoplaying, play / pause / replay work.
  await page.getByRole("button", { name: /^กาแฟดำเย็น/ }).click();
  const playBtn = page.getByRole("button", { name: "เล่นวิธีชง" });
  await playBtn.scrollIntoViewIfNeeded();
  await playBtn.waitFor({ timeout: 10000 });
  await page.waitForTimeout(800);
  ok(await page.getByRole("button", { name: "หยุดชั่วคราว" }).count() === 0, `[${label}] animation does not autoplay`);
  await page.locator(".player").screenshot({ path: `${OUT}/${label}-player-idle.png` });
  await playBtn.click();
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "หยุดชั่วคราว" }).click();
  const resume = page.getByRole("button", { name: "เล่นต่อ" });
  ok(await resume.isVisible(), `[${label}] pause shows เล่นต่อ`);
  await page.getByRole("button", { name: "เล่นใหม่" }).click();
  await page.waitForTimeout(400);
  ok(await page.getByRole("button", { name: "หยุดชั่วคราว" }).isVisible(), `[${label}] replay restarts playback`);

  // Every recipe animation plays.
  for (const name of Object.keys(recipes)) {
    await page.getByRole("button", { name: new RegExp(`^${name}`) }).click();
    const play = page.getByRole("button", { name: "เล่นวิธีชง" });
    await play.scrollIntoViewIfNeeded();
    await play.click();
    await page.waitForTimeout(6000);
    ok(await page.getByRole("button", { name: "หยุดชั่วคราว" }).isVisible(), `[${label}] ${name}: animation playing`);
    await page.locator(".player").screenshot({ path: `${OUT}/${label}-player-${Object.keys(recipes).indexOf(name) + 1}.png` });
    await page.getByRole("button", { name: "หยุดชั่วคราว" }).click();
  }
  await page.getByRole("button", { name: /^กาแฟดำเย็น/ }).click();

  if (label === "mobile") {
    // Timing check: play the whole animation once and confirm it ends around 14 s.
    await page.getByRole("button", { name: "เล่นวิธีชง" }).click();
    const t0 = Date.now();
    await page.getByRole("button", { name: "หยุดชั่วคราว" }).waitFor({ state: "detached", timeout: 20000 });
    const secs = (Date.now() - t0) / 1000;
    ok(secs > 12 && secs < 16, `[${label}] animation length ${secs.toFixed(1)} s`);
    await page.locator(".player").screenshot({ path: `${OUT}/${label}-player-end.png` });
  }

  ok(errors.length === 0, `[${label}] no page errors ${errors.join(" | ")}`);
  await ctx.close();
}

// Reduced motion: static picture, no player bundle until asked.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.locator(".animation").scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  ok(await page.locator(".still").count() === 1 && await page.locator(".player").count() === 0, "[reduced motion] static recipe view instead of player");
  await page.locator(".animation").screenshot({ path: `${OUT}/mobile-reduced-motion.png` });
  await page.getByRole("button", { name: "เปิดภาพเคลื่อนไหว" }).click();
  await page.getByRole("button", { name: "เล่นวิธีชง" }).waitFor({ timeout: 10000 });
  ok(true, "[reduced motion] opt-in loads the player");
  await ctx.close();
}

// Routing: / goes to the page, the page loads with and without a trailing slash and on refresh.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  for (const path of ["/", "/cold-brew-recipes", "/cold-brew-recipes/"]) {
    const res = await page.goto(ORIGIN + path, { waitUntil: "networkidle" });
    const heading = await page.getByRole("heading", { level: 1 }).innerText().catch(() => "");
    ok(res.ok() && heading.replace(/\u00A0/g, " ").includes("ชงแก้วโปรดง่าย ๆ กับ Balena"), `[routing] ${path} shows the page (${res.status()} → ${new URL(page.url()).pathname})`);
  }
  await page.reload({ waitUntil: "networkidle" });
  ok(await page.getByRole("heading", { level: 1 }).isVisible(), "[routing] refresh keeps the page");
  await ctx.close();
}

// Without JavaScript the recipes are still readable (pre-rendered HTML).
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "load" });
  const text = (await page.locator("body").innerText()).replace(/\u00A0/g, " ");
  ok(["ชงแก้วโปรดง่าย ๆ กับ Balena", "Balena Cold Brew", "50 มล.", "น้ำเย็น", "ใส่น้ำแข็ง", "เก็บอย่างไร"].every((t) => text.includes(t)), "[no JavaScript] heading, ingredients and steps visible");
  await page.screenshot({ path: `${OUT}/mobile-no-javascript.png`, fullPage: true });
  await ctx.close();
}

await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : "\nAll checks passed");
process.exit(problems.length ? 1 : 0);
