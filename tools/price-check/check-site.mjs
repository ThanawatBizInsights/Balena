// End-to-end check of balenaroastery.com/price-check/ run locally: the real middleware.js
// login and api/price-check.js, with an in-memory stand-in for Upstash Redis.
// Usage: npm run build && node tools/price-check/check-site.mjs
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const PORT = 4175, ORIGIN = `http://localhost:${PORT}`;
const USERS = "owner:owner-pass-1,partner:partner-pass-2";
const problems = [];
const ok = (c, m) => { if (!c) problems.push(m); console.log(`${c ? "ok  " : "FAIL"} ${m}`); };

// Without logins configured, the middleware refuses everyone.
delete process.env.PRICE_CHECK_USERS;
const { default: middleware } = await import("../../middleware.js");
const closed = await middleware(new Request(`${ORIGIN}/price-check/`));
ok(closed.status === 503 && !closed.headers.get("x-middleware-next"), "no PRICE_CHECK_USERS: page refused (503)");

const server = spawn("node", ["scripts/serve-dist.mjs", String(PORT)], { env: { ...process.env, PRICE_CHECK_USERS: USERS }, stdio: "pipe" });
await new Promise((r) => server.stdout.once("data", r));
const exe = existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});

try {
  const anon = await fetch(`${ORIGIN}/price-check/`);
  ok(anon.status === 401 && /Basic/.test(anon.headers.get("www-authenticate") || ""), "no login: 401 with a login prompt");
  ok((await fetch(`${ORIGIN}/api/price-check`)).status === 401, "API without login: 401");
  const wrong = await fetch(`${ORIGIN}/price-check/`, { headers: { authorization: "Basic " + btoa("partner:nope") } });
  ok(wrong.status === 401, "wrong password: 401");
  ok((await fetch(`${ORIGIN}/`)).status === 200 && (await fetch(`${ORIGIN}/cold-brew-recipes/`)).status === 200, "rest of the site needs no login");
  const bad = await fetch(`${ORIGIN}/api/price-check`, { method: "PUT", headers: { authorization: "Basic " + btoa("owner:owner-pass-1"), "Content-Type": "application/json" }, body: JSON.stringify({ path: "../../etc", data: {} }) });
  ok(bad.status === 400, "API rejects an unknown path");

  const open = async (user, pass) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, httpCredentials: { username: user, password: pass } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${ORIGIN}/price-check`);
    await page.waitForFunction(() => document.getElementById("sync").textContent.includes("บันทึกร่วมกัน"), null, { timeout: 8000 });
    return { ctx, page, errors };
  };
  const owner = await open("owner", "owner-pass-1");
  ok(true, "owner signs in and the page uses shared saving");
  await owner.page.locator('[data-id="milk-choc"][data-k="siam"]').fill("380");
  await owner.page.locator('[data-id="milk-choc"][data-k="online"]').fill("418");
  await owner.page.waitForFunction(() => document.getElementById("sync").textContent.includes("บันทึกแล้ว"), null, { timeout: 8000 });
  ok(true, "owner's prices saved");

  const partner = await open("partner", "partner-pass-2");
  ok((await partner.page.locator('[data-id="milk-choc"][data-k="online"]').inputValue()) === "418", "partner sees the owner's price on opening");
  ok((await partner.page.locator('[data-result="milk-choc"]').innerText()).includes("+10%"), "partner sees the +10% difference");

  await partner.page.locator('[data-id="kenya-muranga"][data-k="siam"]').fill("450");
  await partner.page.waitForFunction(() => document.getElementById("sync").textContent.includes("บันทึกแล้ว"), null, { timeout: 8000 });
  await owner.page.waitForFunction(() => document.querySelector('[data-id="kenya-muranga"][data-k="siam"]').value === "450", null, { timeout: 15000 });
  ok(true, "owner's open page picks up the partner's price within 10 s");

  const saved = await (await fetch(`${ORIGIN}/api/price-check`, { headers: { authorization: "Basic " + btoa("owner:owner-pass-1") } })).json();
  ok(saved.docs["items/kenya-muranga"]?._by === "partner", "saved record notes who changed it");

  await owner.page.screenshot({ path: "tools/price-check/screenshots/site-mobile.png" });
  ok(owner.errors.length === 0 && partner.errors.length === 0, `no page errors ${[...owner.errors, ...partner.errors].join(" | ")}`);
  await owner.ctx.close(); await partner.ctx.close();
} finally {
  await browser.close();
  server.kill();
}
console.log(problems.length ? `\n${problems.length} problem(s)` : "\nAll checks passed");
process.exit(problems.length ? 1 : 0);
