// Shop pages check: home (/), catalogue (/products), about (/about), old-address redirects,
// at 390, 768 and 1440px. Run against `npm run serve:dist` (SITE_ORIGIN to override).
import { chromium } from "playwright";
import { existsSync, mkdirSync, readFileSync } from "node:fs";

const ORIGIN = process.env.SITE_ORIGIN ?? "http://localhost:4173";
const exe = process.env.CHROMIUM_PATH ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
mkdirSync("screenshots/site", { recursive: true });
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const problems = [];
const ok = (c, m) => { if (!c) problems.push(m); console.log(`${c ? "ok  " : "FAIL"} ${m}`); };
const norm = (s) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();

// Product list straight from the data file, so a new product is checked automatically.
const src = readFileSync("src/data/products.ts", "utf8");
const slugs = [...src.matchAll(/slug: "([a-z0-9-]+)"/g)].map((m) => m[1]);
const coldBrew = slugs.filter((s) => s.startsWith("cold-brew"));
const beans = slugs.filter((s) => !s.startsWith("cold-brew"));

async function newPage(viewport, opts = {}) {
  const ctx = await browser.newContext({ viewport, ...opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.offsite = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && page.errors.push(m.text()));
  page.on("response", (r) => r.status() >= 400 && page.errors.push(`HTTP ${r.status()} ${r.url()}`));
  page.on("request", (r) => { if (!r.url().startsWith(ORIGIN) && !r.url().startsWith("data:")) page.offsite.push(r.url()); });
  return { ctx, page };
}

async function loadAll(page) {
  await page.evaluate(async () => {
    for (const i of document.images) i.loading = "eager";
    await Promise.all([...document.images].map((i) => i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 5000); })));
  });
}
const brokenImages = (page) => page.evaluate(() => [...document.images].filter((i) => i.naturalWidth === 0).map((i) => i.currentSrc || i.src));
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

/** Nothing of the old basket and demo checkout may remain. */
async function noBasket(page, where) {
  const text = norm(await page.locator("body").innerText());
  const words = ["ตะกร้า", "ใส่ตะกร้า", "ชำระเงิน", "ยืนยันคำสั่งซื้อ", "ทดลองสั่งซื้อ", "DEMO", "ราคาทดสอบ", "หน้าทดลอง", "สอบถามราคา"];
  const found = words.filter((w) => text.includes(w));
  ok(found.length === 0, `[${where}] no basket/checkout/demo wording ${found.join(", ")}`);
  const controls = await page.locator("form, input, textarea, select, [href*='/trial'], [href*='cart'], [href*='checkout']").count();
  ok(controls === 0, `[${where}] no forms, quantity inputs or cart/checkout links (${controls})`);
  const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k !== "balena-lang"));
  ok(stored.length === 0, `[${where}] nothing but the language choice in localStorage ${stored.join(", ")}`);
}

/** Purchase links: none configured yet, so no buttons and one plain message, never a dead link. */
async function purchaseArea(page, where) {
  const dead = await page.locator("a:not([href]), a[href=''], a[href='#']").count();
  ok(dead === 0, `[${where}] no empty or placeholder links (${dead})`);
  const ext = await page.locator("a[target=_blank]").evaluateAll((as) => as.filter((a) => !/noopener/.test(a.rel) || !/noreferrer/.test(a.rel)).length);
  ok(ext === 0, `[${where}] external links have rel="noopener noreferrer"`);
}

for (const width of [390, 768, 1440]) {
  const viewport = { width, height: width === 390 ? 844 : 900 };
  const tag = `${width}`;

  /* ---------- home ---------- */
  {
    const { ctx, page } = await newPage(viewport);
    await page.goto(ORIGIN + "/", { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    ok(norm(await page.locator("h1").innerText()) === "ชงง่ายที่บ้าน เข้มอร่อยได้ทุกเมนู", `[${tag} home] Thai hook exact`);
    ok(norm(await page.locator(".hero__en").innerText()) === "Your everyday coffee, made at home", `[${tag} home] English hook exact`);
    ok(await page.getByRole("link", { name: "ดูโคลด์บรูว์" }).first().getAttribute("href") === "/products#cold-brew", `[${tag} home] "ดูโคลด์บรูว์" → /products#cold-brew`);
    ok(await page.getByRole("link", { name: "ดูเมล็ดกาแฟ" }).first().getAttribute("href") === "/products#coffee-beans", `[${tag} home] "ดูเมล็ดกาแฟ" → /products#coffee-beans`);
    const order = await page.evaluate(() => [...document.querySelectorAll("main > section, #contact")].map((s) => s.id || s.className.split(" ")[0]));
    ok(order.join(",") === "hero,cold-brew,coffee-beans,intro,contact", `[${tag} home] section order: ${order.join(", ")}`);
    ok(await page.locator(".intro a[href='/about']").count() === 1, `[${tag} home] brand intro links to /about`);
    const details = await page.locator("a[href^='/products?p=']").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    ok(slugs.every((s) => details.some((h) => h.startsWith(`/products?p=${s}#`))), `[${tag} home] every product has a "ดูรายละเอียดสินค้า" link (${details.length})`);
    const nav = await page.locator("#site-nav a").evaluateAll((as) => as.map((a) => `${a.textContent}=${a.getAttribute("href")}`));
    ok(nav.join("|") === "หน้าแรก=/|สินค้าของเรา=/products|รู้จักเรา=/about|ติดต่อเรา=#contact", `[${tag} home] main navigation: ${nav.join(", ")}`);
    if (width === 390) {
      await page.getByRole("button", { name: "เมนู" }).click();
      ok(await page.locator("#site-nav").isVisible(), `[${tag} home] mobile menu opens`);
      await page.keyboard.press("Escape");
      ok(!(await page.locator("#site-nav").isVisible()), `[${tag} home] Escape closes the menu`);
    }
    ok((await page.locator("meta[name=robots]").count()) === 0, `[${tag} home] indexable (no robots noindex)`);
    ok(await page.locator("link[rel=canonical]").getAttribute("href") === "https://www.balenaroastery.com/", `[${tag} home] canonical`);
    await noBasket(page, `${tag} home`);
    await purchaseArea(page, `${tag} home`);
    ok(norm(await page.locator("#contact").innerText()).includes("ช่องทางสั่งซื้อจะอัปเดตเร็ว ๆ นี้"), `[${tag} home] contact: no links yet, plain message`);
    await loadAll(page);
    ok((await brokenImages(page)).length === 0, `[${tag} home] all images load ${(await brokenImages(page)).join(", ")}`);
    ok((await overflow(page)) <= 0, `[${tag} home] no horizontal scroll`);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `screenshots/site/${tag}_home.png`, fullPage: true });

    // A "ดูรายละเอียดสินค้า" button opens that product in the catalogue.
    const target = beans[3];
    await page.locator(`a[href^='/products?p=${target}#']`).first().click();
    await page.waitForURL(/\/products/);
    await page.waitForFunction((s) => document.querySelector(`[data-slug="${s}"][aria-selected="true"]`), target);
    ok(true, `[${tag} home] product button opens ${target} in the catalogue`);
    ok(page.errors.length === 0, `[${tag} home] no errors ${page.errors.join(" | ")}`);
    ok(page.offsite.length === 0, `[${tag} home] no requests off the site ${page.offsite.join(", ")}`);
    await ctx.close();
  }

  /* ---------- catalogue ---------- */
  {
    const { ctx, page } = await newPage(viewport);
    await page.goto(ORIGIN + "/products", { waitUntil: "networkidle" });
    const ids = await page.locator("section.catalog").evaluateAll((s) => s.map((x) => x.id));
    ok(ids.join(",") === "cold-brew,coffee-beans", `[${tag} products] cold brew first, then coffee beans (${ids.join(", ")})`);
    ok(norm(await page.locator("h1").innerText()) === "สินค้าของเรา", `[${tag} products] h1 สินค้าของเรา`);
    ok(await page.locator("link[rel=canonical]").getAttribute("href") === "https://www.balenaroastery.com/products", `[${tag} products] canonical`);

    for (const [section, list] of [["cold-brew", coldBrew], ["coffee-beans", beans]]) {
      const tabs = page.locator(`#${section} [role=tab]`);
      ok((await tabs.count()) === list.length, `[${tag} products] #${section} has ${list.length} selectable products`);
      for (const slug of list) {
        await page.locator(`#${section} [data-slug="${slug}"]`).click();
        const state = await page.evaluate(({ section, slug }) => {
          const sec = document.getElementById(section);
          return {
            selected: sec.querySelector("[aria-selected=true]")?.dataset.slug,
            name: sec.querySelector(".catalog__name")?.textContent,
            tabName: sec.querySelector(`[data-slug="${slug}"] .chip__name`)?.textContent,
            img: sec.querySelector(".catalog__img img")?.getAttribute("src") ?? "",
            p: new URLSearchParams(location.search).get("p"),
            emptyRows: [...sec.querySelectorAll(".specs dd")].filter((d) => !d.textContent.trim() || /ยังไม่ระบุ/.test(d.textContent)).length,
          };
        }, { section, slug });
        const imgOk = state.img.includes(slug) || (slug === "house-blends" && state.img.includes("house-blends"));
        ok(state.selected === slug && state.name === state.tabName && imgOk && state.p === slug && state.emptyRows === 0,
          `[${tag} products] ${slug}: tab, name, image and address change together, no empty rows`);
      }
    }
    // The other section keeps its own selection.
    ok(await page.locator(`#cold-brew [aria-selected=true]`).getAttribute("data-slug") === coldBrew.at(-1), `[${tag} products] cold brew keeps its own selection`);

    // Keyboard: arrows move between products in a section.
    await page.locator(`#coffee-beans [data-slug="${beans[0]}"]`).click();
    await page.keyboard.press("ArrowRight");
    ok(await page.evaluate(() => document.activeElement?.dataset.slug) === beans[1] &&
      await page.locator(`#coffee-beans [aria-selected=true]`).getAttribute("data-slug") === beans[1], `[${tag} products] → key selects the next product`);
    await page.keyboard.press("End");
    ok(await page.locator(`#coffee-beans [aria-selected=true]`).getAttribute("data-slug") === beans.at(-1), `[${tag} products] End selects the last product`);
    // Arrow buttons (no swipe needed).
    await page.locator("#coffee-beans").getByRole("button", { name: "เมล็ดกาแฟคั่วถัดไป" }).click();
    ok(await page.locator(`#coffee-beans [aria-selected=true]`).getAttribute("data-slug") === beans[0], `[${tag} products] next button wraps to the first product`);

    // Back / forward.
    await page.goBack();
    await page.waitForFunction((s) => document.querySelector(`#coffee-beans [data-slug="${s}"][aria-selected=true]`), beans.at(-1));
    ok(true, `[${tag} products] back restores the previous product`);
    await page.goForward();
    await page.waitForFunction((s) => document.querySelector(`#coffee-beans [data-slug="${s}"][aria-selected=true]`), beans[0]);
    ok(true, `[${tag} products] forward returns to it`);

    // House Blends has two photos: both reachable.
    await page.locator(`#coffee-beans [data-slug="house-blends"]`).click();
    await page.locator("#coffee-beans .catalog__pics button").nth(1).click();
    ok((await page.locator("#coffee-beans .catalog__img img").getAttribute("src")).includes("house-blends-alt"), `[${tag} products] second House Blends photo shows`);

    // Purchase area.
    ok(await page.locator("#coffee-beans .buy__soon").innerText().then(norm) === "ช่องทางสั่งซื้อจะอัปเดตเร็ว ๆ นี้", `[${tag} products] no links configured: plain message, no buttons`);
    ok((await page.locator(".buy__btn").count()) === 0, `[${tag} products] no purchase buttons without real links`);
    await noBasket(page, `${tag} products`);
    await purchaseArea(page, `${tag} products`);

    await loadAll(page);
    ok((await brokenImages(page)).length === 0, `[${tag} products] all images load ${(await brokenImages(page)).join(", ")}`);
    ok((await overflow(page)) <= 0, `[${tag} products] no horizontal scroll`);
    if (width === 390) {
      const [img, panel] = await Promise.all(["#cold-brew .catalog__visual", "#cold-brew .catalog__panel"].map((s) => page.locator(s).boundingBox()));
      ok(img.y + img.height <= panel.y, `[${tag} products] image above the information panel on mobile`);
    }
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `screenshots/site/${tag}_products.png`, fullPage: true });
    ok(page.errors.length === 0, `[${tag} products] no errors ${page.errors.join(" | ")}`);
    ok(page.offsite.length === 0, `[${tag} products] no requests off the site`);
    await ctx.close();
  }

  /* ---------- deep links, refresh, unknown slug ---------- */
  {
    const { ctx, page } = await newPage(viewport);
    await page.goto(ORIGIN + "/products?p=whiskey", { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector('#coffee-beans [data-slug="whiskey"][aria-selected=true]'));
    await page.waitForTimeout(400);
    const top = await page.locator("#coffee-beans").evaluate((e) => e.getBoundingClientRect().top);
    ok(Math.abs(top) < 120, `[${tag} deep link] ?p=whiskey selects it and scrolls to coffee beans (top ${Math.round(top)})`);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector('#coffee-beans [data-slug="whiskey"][aria-selected=true]'));
    ok(true, `[${tag} deep link] refresh keeps the selection`);
    await page.goto(ORIGIN + "/products?p=cold-brew-concentrate-smooth-black", { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector('#cold-brew [data-slug="cold-brew-concentrate-smooth-black"][aria-selected=true]'));
    ok(true, `[${tag} deep link] existing ?p=cold-brew-concentrate-smooth-black format works`);
    await page.goto(ORIGIN + "/products?p=no-such-coffee#coffee-beans", { waitUntil: "networkidle" });
    await page.waitForTimeout(200);
    ok(!page.url().includes("no-such-coffee") && page.url().endsWith("#coffee-beans") &&
      await page.locator(`#coffee-beans [aria-selected=true]`).getAttribute("data-slug") === beans[0], `[${tag} deep link] unknown slug falls back to the first product`);
    ok(page.errors.length === 0, `[${tag} deep link] no errors ${page.errors.join(" | ")}`);
    await ctx.close();
  }

  /* ---------- about ---------- */
  {
    const { ctx, page } = await newPage(viewport);
    await page.goto(ORIGIN + "/about", { waitUntil: "networkidle" });
    const text = norm(await page.locator("main").innerText());
    for (const s of ["รู้จัก", "ทำไมต้องวาฬ", "Balena แปลว่า “วาฬ”", "สิ่งที่เราทำ", "เมนูซิกเนเจอร์", "เอสเปรสโซโซดามะนาว", "A small cup for a brighter world"]) {
      ok(text.includes(s), `[${tag} about] has "${s}"`);
    }
    const imgs = await page.locator("main img").evaluateAll((is) => is.map((i) => i.getAttribute("src")));
    ok(["balena-welcome", "balena-banner", "balena-signature-drinks", "balena-whale-sticker"].every((n) => imgs.some((s) => s.includes(n))), `[${tag} about] earlier home imagery kept`);
    ok(await page.locator("#site-nav a[aria-current=page]").innerText() === "รู้จักเรา", `[${tag} about] nav marks รู้จักเรา`);
    await page.getByRole("button", { name: "EN" }).click();
    ok((await page.locator("h1").innerText()).includes("About") && (await page.evaluate(() => document.documentElement.lang)) === "en", `[${tag} about] English switch works`);
    await page.getByRole("button", { name: "ไทย" }).click();
    await noBasket(page, `${tag} about`);
    await purchaseArea(page, `${tag} about`);
    await loadAll(page);
    ok((await brokenImages(page)).length === 0, `[${tag} about] all images load`);
    ok((await overflow(page)) <= 0, `[${tag} about] no horizontal scroll`);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: `screenshots/site/${tag}_about.png`, fullPage: true });
    ok(page.errors.length === 0, `[${tag} about] no errors ${page.errors.join(" | ")}`);
    ok(page.offsite.length === 0, `[${tag} about] no requests off the site`);
    await ctx.close();
  }
}

/* ---------- old addresses, other pages, reduced motion, no JavaScript ---------- */
{
  const { ctx, page } = await newPage({ width: 390, height: 844 });
  const cases = [
    ["/trial/order?p=kenya-muranga", "/products?p=kenya-muranga"],
    ["/trial/products/blue-magic", "/products?p=blue-magic"],
    ["/trial/cart", "/products"],
    ["/trial/checkout", "/products"],
    ["/trial/complete", "/products"],
    ["/trial", "/"],
    ["/trial#beans", "/#coffee-beans"],
    ["/#story", "/about#story"],
    ["/#buy", "/#contact"],
  ];
  for (const [from, to] of cases) {
    await page.goto(ORIGIN + from, { waitUntil: "networkidle" });
    await page.waitForTimeout(150);
    const u = new URL(page.url());
    ok(u.pathname + u.search + u.hash === to, `[redirect] ${from} → ${u.pathname + u.search + u.hash}`);
  }
  await page.goto(ORIGIN + "/trial/order?p=kenya-muranga", { waitUntil: "networkidle" });
  ok(await page.locator(`#coffee-beans [aria-selected=true]`).getAttribute("data-slug") === "kenya-muranga", "[redirect] old order link still selects its product");

  for (const path of ["/cold-brew-recipes/", "/cost-calculator/", "/sitemap.xml", "/robots.txt"]) {
    const r = await page.goto(ORIGIN + path);
    ok(r.ok(), `[other] ${path} still served (${r.status()})`);
  }
  await page.goto(ORIGIN + "/cost-calculator/");
  ok(await page.locator("meta[name=robots]").getAttribute("content") === "noindex, nofollow", "[other] calculator stays noindex");
  const sitemap = await (await page.request.get(ORIGIN + "/sitemap.xml")).text();
  ok(["/</loc>", "/products</loc>", "/about</loc>"].every((s) => sitemap.includes(s)) && !sitemap.includes("trial") && !sitemap.includes("cost"), "[other] sitemap lists /, /products, /about only with public pages");
  await ctx.close();

  const rm = await newPage({ width: 390, height: 844 }, { reducedMotion: "reduce" });
  await rm.page.goto(ORIGIN + "/", { waitUntil: "networkidle" });
  ok(await rm.page.locator(".hero__pouch").evaluate((e) => getComputedStyle(e).animationName) === "none", "[reduced motion] hero stays still");
  await rm.page.goto(ORIGIN + "/products?p=laos-bolaven", { waitUntil: "networkidle" });
  ok(await rm.page.locator("#coffee-beans .catalog__img").evaluate((e) => getComputedStyle(e).animationName) === "none", "[reduced motion] product swap has no animation");
  await rm.ctx.close();

  const nojs = await newPage({ width: 390, height: 844 }, { javaScriptEnabled: false });
  for (const [path, s] of [["/", "ชงง่ายที่บ้าน"], ["/products", "Kenya Muranga"], ["/about", "ทำไมต้องวาฬ"]]) {
    await nojs.page.goto(ORIGIN + path);
    ok(norm(await nojs.page.locator("body").innerText()).includes(s), `[no JS] ${path} readable from pre-rendered HTML`);
  }
  await nojs.ctx.close();
}

await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : "\nAll checks passed");
process.exit(problems.length ? 1 : 0);
