// Cost calculator check at 390px and 1366px. Run against `npm run serve:dist`.
import { chromium } from "playwright";
import { existsSync, mkdirSync } from "node:fs";

const URL_ = process.env.COST_URL ?? "http://localhost:4173/cost-calculator/";
const exe = process.env.CHROMIUM_PATH ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
mkdirSync("screenshots", { recursive: true });
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const problems = [];
const ok = (c, m) => { if (!c) problems.push(m); console.log(`${c ? "ok  " : "FAIL"} ${m}`); };
const money = (s) => parseFloat(s.replace(/[฿,]/g, ""));

for (const [label, viewport] of [["mobile", { width: 390, height: 844 }], ["desktop", { width: 1366, height: 900 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: label === "mobile" ? 2 : 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(URL_, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);

  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  ok(robots?.includes("noindex"), `[${label}] noindex`);

  const cost = () => page.locator(".result .stat").first().locator(".stat__value").innerText().then(money);
  ok(Math.abs((await cost()) - 104.05) < 0.02, `[${label}] starting cost per pouch ฿${await cost()} (expected ฿104.05)`);
  const body = await page.locator("body").innerText();
  for (const t of ["5 ถุง × 500 มล.", "เหลือ 100 มล.", "กากกาแฟดูดน้ำไว้ 400 มล.", "1 : 8", "ถุงเพาช์ 500 มล.", "สติกเกอร์ฉลาก", "ค่าแรงของคุณ", "เจลเย็นหรือไอซ์แพ็ก"]) {
    ok(body.includes(t), `[${label}] shows "${t}"`);
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(overflow <= 0, `[${label}] no horizontal scroll (${overflow}px)`);

  await page.screenshot({ path: `screenshots/cost-${label}-first-screen.png` });
  await page.screenshot({ path: `screenshots/cost-${label}-full.png`, fullPage: true });

  // Editing: coffee at 800 ฿/kg adds 375 g × 200 ฿/kg ÷ 5 = 15 ฿, plus the 5% waste on it.
  const before = await cost();
  await page.locator("#coffeePrice").fill("800");
  const expected = before + 15 + (15 * 0.05) / 0.95;
  ok(Math.abs((await cost()) - expected) < 0.02, `[${label}] coffee price updates cost (฿${await cost()} vs ฿${expected.toFixed(2)})`);

  // Turning on free shipping adds 40 ÷ 2 pouches = 20 ฿.
  const b2 = await cost();
  await page.getByRole("checkbox", { name: /ค่าส่ง/ }).check();
  ok(Math.abs((await cost()) - (b2 + 20)) < 0.02, `[${label}] free-shipping toggle adds ฿20`);

  // Values survive a reload, and reset restores them.
  await page.reload({ waitUntil: "networkidle" });
  ok(Math.abs((await cost()) - (b2 + 20)) < 0.02, `[${label}] values kept after reload`);
  await page.getByRole("button", { name: "กลับไปใช้ค่าตั้งต้น" }).click();
  ok(Math.abs((await cost()) - 104.05) < 0.02, `[${label}] reset restores starting values`);

  // A price below cost shows a loss and no break-even.
  await page.locator("#price-top").fill("80");
  const sales = await page.locator(".breakeven__caption").innerText();
  ok((await page.locator(".result").innerText()).includes("ขาดทุนต่อถุง") && sales.includes("ยังไม่พอ"), `[${label}] loss state at ฿80`);
  await page.getByRole("button", { name: "กลับไปใช้ค่าตั้งต้น" }).click();

  const small = await page.evaluate(() =>
    [...document.querySelectorAll("button, input")].filter((el) => el.offsetParent && el.getBoundingClientRect().height < 24).length,
  );
  ok(small === 0, `[${label}] controls are large enough`);
  ok(errors.length === 0, `[${label}] no errors ${errors.join(" | ")}`);
  await ctx.close();
}
await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : "\nAll checks passed");
process.exit(problems.length ? 1 : 0);
