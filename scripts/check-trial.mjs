// Trial storefront check (/trial...), run against `npm run serve:dist` or another server:
//   TRIAL_ORIGIN=http://localhost:4173 node scripts/check-trial.mjs
// Walks home → product → detail → variant → cart → demo checkout → demo completion at 390,
// 768 and 1440 px; checks prices and totals, cart persistence, swipe and buttons, overflow,
// broken images, console errors, and that no request leaves the site or hits an API.
import { chromium } from "playwright";
import { existsSync, mkdirSync } from "node:fs";

const ORIGIN = process.env.TRIAL_ORIGIN ?? "http://localhost:4173";
const OUT = "screenshots/trial";
mkdirSync(OUT, { recursive: true });
const exe = existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const problems = [];
const ok = (c, m) => { if (!c) problems.push(m); console.log(`${c ? "ok  " : "FAIL"} ${m}`); };
const money = (s) => parseFloat(String(s).replace(/[^\d.]/g, ""));

async function loadAll(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    // Walk down the page so lazy images start, then back to the top.
    for (let y = 0; y < document.body.scrollHeight; y += innerHeight / 2) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 180)); }
    scrollTo(0, 0);
    const imgs = [...document.images];
    imgs.forEach((i) => { i.loading = "eager"; });
    await Promise.race([
      Promise.all(imgs.map((i) => (i.complete ? 0 : new Promise((r) => { i.addEventListener("load", r); i.addEventListener("error", r); })))),
      new Promise((r) => setTimeout(r, 5000)),
    ]);
  });
  await page.waitForTimeout(900); // let entrance animations settle
}
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const broken = (page) => page.evaluate(() => [...document.images].filter((i) => i.complete && !i.naturalWidth).map((i) => i.src));

for (const [label, viewport] of [["390", { width: 390, height: 844 }], ["768", { width: 768, height: 1024 }], ["1440", { width: 1440, height: 900 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: label === "390" });
  const page = await ctx.newPage();
  const errors = [], offsite = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (u.origin !== ORIGIN || u.pathname.startsWith("/api/")) offsite.push(r.method() + " " + r.url());
  });

  for (const path of ["/trial", "/trial/order", "/trial/products/brazil-cerrado", "/trial/products/cold-brew-coffee-original", "/trial/cart"]) {
    await page.goto(ORIGIN + path, { waitUntil: "networkidle" });
    await loadAll(page);
    ok((await overflow(page)) <= 0, `[${label}] ${path}: no horizontal scroll`);
    ok((await broken(page)).length === 0, `[${label}] ${path}: no broken images`);
    await page.screenshot({ path: `${OUT}/${label}${path.replace(/\//g, "_")}.png`, fullPage: true });
  }

  // Robots: every trial page is noindex.
  ok((await page.locator('meta[name="robots"]').getAttribute("content"))?.includes("noindex"), `[${label}] noindex meta`);

  // Without confirmed prices: "สอบถามราคา" and no way to buy.
  await page.goto(ORIGIN + "/trial/order?p=house-blends", { waitUntil: "networkidle" });
  ok((await page.locator(".order__panel .price").first().innerText()).includes("สอบถามราคา"), `[${label}] unpriced item shows สอบถามราคา`);
  ok((await page.getByRole("button", { name: "ใส่ตะกร้า" }).count()) === 0, `[${label}] unpriced item cannot be added`);

  // Home: hooks, CTAs, showcase arrows and keys.
  await page.goto(ORIGIN + "/trial", { waitUntil: "networkidle" });
  const body = await page.locator("main").innerText();
  ok(body.includes("ชงง่ายที่บ้าน") && body.includes("เข้มอร่อยได้ทุกเมนู") && body.includes("Your everyday coffee, made at home"), `[${label}] exact Thai and English hooks`);
  ok(await page.getByRole("link", { name: "เลือกซื้อโคลด์บรูว์" }).isVisible() && await page.getByRole("link", { name: "เลือกเมล็ดกาแฟ" }).isVisible(), `[${label}] both hero CTAs`);
  const count = () => page.locator(".show__count").innerText();
  await page.getByRole("button", { name: "สินค้าถัดไป" }).first().click();
  await page.waitForTimeout(700);
  ok((await count()).startsWith("02"), `[${label}] next button moves the gallery (${await count()})`);
  ok((await page.locator(".show__title").innerText()).includes("Cold Brew Coffee"), `[${label}] detail follows the selection`);
  await page.locator(".show__track").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(700);
  ok((await count()).startsWith("03"), `[${label}] → key moves the gallery`);
  if (label === "390") {
    // Swipe: scroll the track by two cards.
    await page.locator(".show__track").evaluate((t) => { t.scrollBy({ left: t.children[0].clientWidth * 2 + 16, behavior: "auto" }); });
    await page.waitForTimeout(500);
    ok((await count()).startsWith("05"), `[${label}] swiping the gallery updates the counter (${await count()})`);
    await page.getByRole("button", { name: "เมนู" }).click();
    ok(await page.locator("#trial-nav").isVisible(), `[${label}] mobile menu opens`);
    await page.getByRole("button", { name: "ปิด" }).click();
  }

  // Journey with review prices: home → product → detail → variant → cart → checkout → complete.
  await page.goto(ORIGIN + "/trial?test-prices=1", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.removeItem("balena-trial-cart-v1"));
  await page.locator(".shelf__item", { hasText: "Blue Magic" }).first().click();
  await page.waitForURL(/\/trial\/products\/blue-magic$/);
  ok(true, `[${label}] home → Blue Magic detail page`);
  ok((await page.locator(".pdp .price").first().innerText()).includes("ราคาทดสอบ"), `[${label}] test price clearly badged`);
  await page.getByRole("button", { name: "เพิ่มจำนวน" }).click();
  ok(money(await page.locator(".buy__total b").innerText()) === 200, `[${label}] live total 2 × ฿100 = ฿200`);
  await page.getByRole("button", { name: "ใส่ตะกร้า" }).click();
  ok(await page.locator(".toast.is-on").waitFor({ timeout: 2000 }).then(() => true, () => false), `[${label}] add-to-cart confirmation`);
  ok((await page.locator(".cart-btn__count").innerText()) === "2", `[${label}] cart count 2`);

  await page.goto(ORIGIN + "/trial/order?p=cold-brew-concentrate-smooth-black", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "ใส่ตะกร้า" }).click();
  await page.goto(ORIGIN + "/trial/products/blue-magic", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "ใส่ตะกร้า" }).click();
  await page.reload({ waitUntil: "networkidle" });
  ok((await page.locator(".cart-btn__count").innerText()) === "4", `[${label}] cart kept after reload (4 items)`);

  await page.goto(ORIGIN + "/trial/cart", { waitUntil: "networkidle" });
  ok((await page.locator(".line").count()) === 2, `[${label}] same variant merges, different products are separate lines`);
  ok(money(await page.locator(".summary__total b").innerText()) === 400, `[${label}] cart total ฿400`);
  await page.locator(".line", { hasText: "Blue Magic" }).getByRole("button", { name: "ลดจำนวน" }).click();
  ok(money(await page.locator(".summary__total b").innerText()) === 300, `[${label}] quantity change updates total to ฿300`);
  await loadAll(page);
  await page.screenshot({ path: `${OUT}/${label}_trial_cart-filled.png`, fullPage: true });

  // Turning test prices off makes the lines unavailable instead of charging a fake price.
  await page.goto(ORIGIN + "/trial/cart?test-prices=0", { waitUntil: "networkidle" });
  ok((await page.locator(".line.is-off").count()) === 2 && await page.getByRole("button", { name: "ไปทดลองสั่งซื้อ" }).isDisabled(), `[${label}] without prices: lines flagged, checkout disabled`);
  await page.goto(ORIGIN + "/trial/cart?test-prices=1", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: "ไปทดลองสั่งซื้อ" }).click();
  await page.waitForURL(/\/trial\/checkout$/);
  ok((await page.locator(".demo-banner").innerText()).includes("ทดลองสั่งซื้อ — ยังไม่มีการเรียกเก็บเงินหรือส่งคำสั่งซื้อจริง"), `[${label}] demo checkout notice`);
  ok((await page.locator('input[type="password"], input[autocomplete^="cc-"]').count()) === 0, `[${label}] no payment fields`);
  await page.getByRole("button", { name: "ยืนยันทดลองสั่งซื้อ" }).click();
  ok(await page.locator("#co-err").isVisible(), `[${label}] name required, error shown`);
  await page.locator("#co-name").fill("ทดสอบ ระบบ");
  await page.locator("#co-phone").fill("0800000000");
  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  ok(!stored.includes("ทดสอบ ระบบ") && !stored.includes("0800000000"), `[${label}] form details not stored`);
  await loadAll(page);
  await page.screenshot({ path: `${OUT}/${label}_trial_checkout.png`, fullPage: true });
  await page.getByRole("button", { name: "ยืนยันทดลองสั่งซื้อ" }).click();
  await page.waitForURL(/\/trial\/complete$/);
  const done = await page.locator(".thanks").innerText();
  ok(done.includes("ขอบคุณที่ทดลองสั่งซื้อกับ Balena") && /DEMO-\d{6}/.test(done), `[${label}] completion page with demo reference`);
  ok(money(await page.locator(".receipt .summary__total b").innerText()) === 300, `[${label}] completion total ฿300`);
  ok((await page.locator(".cart-btn__count").innerText()) === "0", `[${label}] cart emptied after demo order`);
  await loadAll(page);
  await page.screenshot({ path: `${OUT}/${label}_trial_complete.png`, fullPage: true });
  await page.getByRole("link", { name: "เลือกสินค้าต่อ" }).click();
  await page.waitForURL(/\/trial\/order/);
  ok(true, `[${label}] "เลือกสินค้าต่อ" returns to the order page`);

  // Unknown product.
  await page.goto(ORIGIN + "/trial/products/not-a-coffee", { waitUntil: "networkidle" });
  ok((await page.locator("h1").innerText()).includes("ไม่พบ"), `[${label}] unknown product shows not found`);

  ok(offsite.length === 0, `[${label}] no requests off the site or to APIs ${offsite.slice(0, 3).join(" | ")}`);
  ok(errors.length === 0, `[${label}] no console errors ${errors.slice(0, 3).join(" | ")}`);
  await ctx.close();
}

// Reduced motion still completes the journey's key screen.
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await page.goto(ORIGIN + "/trial", { waitUntil: "networkidle" });
  const anim = await page.locator(".hero__pouch").evaluate((el) => getComputedStyle(el).animationName);
  ok(anim === "none", `reduced motion: hero animation off (${anim})`);
  await ctx.close();
}

// Live pages are untouched.
for (const path of ["/", "/cold-brew-recipes/", "/cost-calculator/"]) {
  const res = await fetch(ORIGIN + path);
  ok(res.ok && !(await res.text()).includes("/src/trial/"), `live page ${path} still served, without the trial`);
}

await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : "\nAll checks passed");
process.exit(problems.length ? 1 : 0);
