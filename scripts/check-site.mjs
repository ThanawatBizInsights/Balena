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
// Store links straight from the config, so the check follows it.
const cfg = readFileSync("src/config/purchase-links.ts", "utf8");
const store = Object.fromEntries([...cfg.matchAll(/^  (\w+): "([^"]*)"/gm)].map((m) => [m[1], m[2]]));
const productChannels = JSON.parse(cfg.match(/PRODUCT_CHANNELS: Channel\[\] = (\[[^\]]*\])/)[1]);
const expectedBuy = productChannels.map((c) => store[c]).filter(Boolean);
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
    ok(norm(await page.locator(".hero__sub").innerText()) === "Your everyday coffee, made at home", `[${tag} home] English hook exact`);
    ok(await page.getByRole("link", { name: "ดูโคลด์บรูว์" }).first().getAttribute("href") === "/products#cold-brew", `[${tag} home] "ดูโคลด์บรูว์" → /products#cold-brew`);
    ok(await page.getByRole("link", { name: "ดูเมล็ดกาแฟ" }).first().getAttribute("href") === "/products#coffee-beans", `[${tag} home] "ดูเมล็ดกาแฟ" → /products#coffee-beans`);
    const order = await page.evaluate(() => [...document.querySelectorAll("main > section, #contact")].map((s) => s.id || s.className.split(" ")[0]));
    ok(order.join(",") === "hero,cold-brew,coffee-beans,intro,contact", `[${tag} home] section order: ${order.join(", ")}`);
    ok(await page.locator(".intro a[href='/about']").count() === 1, `[${tag} home] brand intro links to /about`);
    const details = await page.locator("a[href^='/products?p=']").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    ok(slugs.every((s) => details.some((h) => h.startsWith(`/products?p=${s}#`))), `[${tag} home] every product has a "ดูรายละเอียดสินค้า" link (${details.length})`);
    const nav = await page.locator("#site-nav a").evaluateAll((as) => as.map((a) => `${a.textContent}=${a.getAttribute("href")}`));
    ok(nav.join("|") === "หน้าแรก=/|สินค้าของเรา=/products|ช่องทางสั่งซื้อ=/shop|รู้จักเรา=/about|ติดต่อเรา=#contact", `[${tag} home] main navigation: ${nav.join(", ")}`);
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
    const contactLinks = await page.locator("#contact .buy__btn").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    ok(contactLinks.join(" ") === expectedBuy.join(" "), `[${tag} home] contact shows the configured store links (${contactLinks.length})`);
    ok(await page.locator("#contact a[href='/shop']").count() === 1, `[${tag} home] contact links to /shop`);
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
    const buy = await page.locator("#coffee-beans .catalog__panel .buy__btn").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    ok(buy.join(" ") === expectedBuy.join(" "), `[${tag} products] product buy buttons use the store links (${buy.length}), only configured channels`);
    ok((await page.locator(".buy__soon").count()) === (expectedBuy.length ? 0 : 3), `[${tag} products] "coming soon" only when no links exist`);
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

/* ---------- Thai / English ---------- */
const THAI = /[\u0E00-\u0E7F]/;
for (const width of [390, 1440]) {
  const viewport = { width, height: width === 390 ? 844 : 900 };
  const tag = `${width} lang`;
  const { ctx, page } = await newPage(viewport);
  const nav = () => page.locator("#site-nav a").allTextContents();

  // First visit: Thai, switch visible.
  await page.goto(ORIGIN + "/products?p=whiskey#coffee-beans", { waitUntil: "networkidle" });
  ok((await page.evaluate(() => document.documentElement.lang)) === "th", `[${tag}] first visit is Thai`);
  ok(await page.getByRole("button", { name: "English" }).isVisible(), `[${tag}] TH / EN switch visible in the header`);

  // Switch on a deep link: product, section and address stay.
  await page.getByRole("button", { name: "English" }).click();
  ok(page.url().endsWith("/products?p=whiskey#coffee-beans"), `[${tag}] switching keeps the address (${page.url().replace(ORIGIN, "")})`);
  ok(await page.locator('#coffee-beans [aria-selected=true]').getAttribute("data-slug") === "whiskey", `[${tag}] switching keeps the selected product`);
  ok((await page.evaluate(() => [document.documentElement.lang, document.title])).join("|") === "en|Our Products | Balena Roastery", `[${tag}] html lang and title follow English`);
  ok((await nav()).join("|") === "Home|Our Products|Where to Buy|About Us|Contact", `[${tag}] navigation in English: ${(await nav()).join(", ")}`);

  // Every public page in English: nothing Thai left (except the approved hero pair on /).
  for (const [path, name] of [["/", "home"], ["/products", "products"], ["/shop", "shop"], ["/about", "about"], ["/cold-brew-recipes/", "recipes"], ["/no-such-page", "404"]]) {
    await page.goto(ORIGIN + path, { waitUntil: "networkidle" });
    ok((await page.evaluate(() => document.documentElement.lang)) === "en", `[${tag}] ${path} stays English after navigating`);
    const leftovers = await page.evaluate((re) => {
      const thai = new RegExp(re);
      const out = [];
      const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) {
        const n = walk.currentNode;
        if (!thai.test(n.textContent) || n.parentElement.closest(".hero__sub, .sr-only:not(*)")) continue;
        if (n.parentElement.closest("[hidden], script, style")) continue;
        out.push(n.textContent.trim());
      }
      const attrs = [...document.querySelectorAll("[aria-label], [alt], [title]")]
        .flatMap((e) => ["aria-label", "alt", "title"].map((a) => e.getAttribute(a) ?? ""))
        .filter((v) => thai.test(v) && v !== "ภาษาไทย");
      return [...out, ...attrs];
    }, THAI.source);
    ok(leftovers.length === 0, `[${tag}] ${path}: no Thai text or labels in English ${leftovers.slice(0, 3).join(" | ")}`);
    const meta = await page.evaluate(() => document.querySelector('meta[name="description"]')?.content ?? "");
    ok(!THAI.test(meta) && meta.length > 0, `[${tag}] ${path}: English meta description`);
    ok((await overflow(page)) <= 0, `[${tag}] ${path}: long English labels fit (no horizontal scroll)`);
    if (path !== "/no-such-page") ok(page.errors.length === 0, `[${tag}] ${path}: no errors ${page.errors.join(" | ")}`);
    page.errors.length = 0;
    await page.screenshot({ path: `screenshots/site/${width}_en_${name}.png`, fullPage: true });
  }
  await page.goto(ORIGIN + "/", { waitUntil: "networkidle" });
  ok(norm(await page.locator("h1").innerText()) === "Your everyday coffee, made at home" &&
    norm(await page.locator(".hero__sub").innerText()) === "ชงง่ายที่บ้าน เข้มอร่อยได้ทุกเมนู", `[${tag}] hero: English headline, Thai hook kept below`);
  const words = norm(await page.locator("body").innerText()).toLowerCase();
  ok(!["cart", "basket", "checkout", "add to", "payment"].some((w) => words.includes(w)), `[${tag}] no basket or checkout wording in English`);

  // Refresh keeps English and shows no Thai flash: the page is hidden until it has switched.
  await page.goto(ORIGIN + "/about", { waitUntil: "commit" });
  const early = await page.evaluate(() => [document.documentElement.lang, document.documentElement.classList.contains("lang-pending")]);
  await page.waitForLoadState("networkidle");
  const late = await page.evaluate(() => [document.documentElement.lang, document.documentElement.classList.contains("lang-pending"), document.querySelector("h1")?.textContent]);
  ok(early[0] === "en" && late[0] === "en" && !late[1] && late[2].includes("About"), `[${tag}] reload keeps English; hidden until switched, then shown`);

  // Back to Thai.
  await page.getByRole("button", { name: "ภาษาไทย" }).click();
  ok((await nav()).join("|") === "หน้าแรก|สินค้าของเรา|ช่องทางสั่งซื้อ|รู้จักเรา|ติดต่อเรา" && (await page.evaluate(() => document.documentElement.lang)) === "th", `[${tag}] switching back to Thai`);
  await page.goto(ORIGIN + "/products", { waitUntil: "networkidle" });
  ok((await page.evaluate(() => document.documentElement.lang)) === "th", `[${tag}] Thai choice remembered`);
  ok(page.errors.length === 0 && page.offsite.length === 0, `[${tag}] no errors or outside requests ${page.errors.join(" | ")}`);
  await ctx.close();
}

/* ---------- /shop ---------- */
{
  const EXPECTED = [
    ["shopee", "https://s.shopee.co.th/9066BIm3oO"],
    ["lineShop", "https://shop.line.me/@808wjfen"],
    ["lineOA", "https://lin.ee/v9eoe5f"],
    ["website", "/"],
    ["grab", "https://grab.onelink.me/2695613898?pid=inappsharing&c=3-C8KBGY42GPK1NE&is_retargeting=true&af_dp=grab%3A%2F%2Fopen%3FscreenType%3DGRABFOOD%26sourceID%3DA4pcqCZkS4%26merchantIDs%3D3-C8KBGY42GPK1NE&af_force_deeplink=true&af_web_dp=https%3A%2F%2Fwww.grab.com%2Fdownload"],
  ];
  for (const width of [390, 1440]) {
    const tag = `${width} shop`;
    const { ctx, page } = await newPage({ width, height: 900 });
    await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: ORIGIN });
    const res = await page.goto(ORIGIN + "/shop", { waitUntil: "networkidle" });
    ok(res.ok(), `[${tag}] /shop opens directly (${res.status()})`);
    await page.reload({ waitUntil: "networkidle" });
    ok(norm(await page.locator("h1").innerText()) === "เลือกช่องทางสั่งซื้อ", `[${tag}] Thai title`);
    ok(await page.locator("link[rel=canonical]").getAttribute("href") === "https://www.balenaroastery.com/shop", `[${tag}] canonical is the production /shop`);
    ok(await page.locator("#site-nav a[aria-current=page]").innerText() === "ช่องทางสั่งซื้อ", `[${tag}] nav marks ช่องทางสั่งซื้อ`);

    const cards = await page.locator(".hub-row").evaluateAll((li) => li.map((l) => {
      const a = l.querySelector("a");
      return { id: [...l.classList].find((c) => c.startsWith("is-")).slice(3), href: a.getAttribute("href"), target: a.target, rel: a.rel };
    }));
    ok(cards.map((c) => c.id).join(",") === EXPECTED.map((e) => e[0]).join(","), `[${tag}] rows in order: ${cards.map((c) => c.id).join(", ")}`);
    for (const [id, href] of EXPECTED) {
      const c = cards.find((x) => x.id === id);
      ok(c?.href === href, `[${tag}] ${id} href is exactly as supplied`);
      if (href.startsWith("https://")) ok(c?.target === "_blank" && c.rel === "noopener noreferrer", `[${tag}] ${id} opens in a new tab safely`);
      else ok(c?.target === "", `[${tag}] website card stays in this tab and points home, not back to /shop`);
    }
    const grab = new URL(cards.find((c) => c.id === "grab").href);
    ok(grab.searchParams.get("af_dp") === "grab://open?screenType=GRABFOOD&sourceID=A4pcqCZkS4&merchantIDs=3-C8KBGY42GPK1NE" &&
      grab.searchParams.get("af_web_dp") === "https://www.grab.com/download" && grab.searchParams.get("af_force_deeplink") === "true",
      `[${tag}] Grab deep-link parameters intact (not double-encoded)`);
    ok(!(await page.locator(".hub").innerText()).match(/Facebook|Lazada/), `[${tag}] no Facebook or Lazada rows yet`);
    ok((await page.locator(".hub__group-h").allInnerTexts()).join("|") === "สั่งซื้อและติดต่อ|เดลิเวอรี", `[${tag}] rows grouped under headings`);
    ok(await page.locator("#contact .hub-row").count() === EXPECTED.length && await page.locator("section.contact").count() === 0, `[${tag}] the channel list is the page's #contact (no duplicate contact band)`);

    // Touch targets and keyboard.
    const small = await page.locator(".hub a, .hub button").evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).length);
    ok(small === 0, `[${tag}] every row and button is at least 44px tall`);
    await page.locator(".hub-row__link").first().focus();
    await page.keyboard.press("Tab");
    ok(await page.evaluate(() => document.activeElement?.closest(".hub-row")?.className.includes("is-lineShop")), `[${tag}] Tab moves row to row`);

    // Copy link: clipboard API, then the fallbacks.
    await page.getByRole("button", { name: "คัดลอกลิงก์หน้านี้" }).click();
    await page.locator(".hub__status.is-done").waitFor({ timeout: 2000 });
    ok(await page.evaluate(() => navigator.clipboard.readText()) === "https://www.balenaroastery.com/shop", `[${tag}] copies the production URL, not this preview's`);
    ok(norm(await page.locator(".hub__status").innerText()) === "คัดลอกลิงก์แล้ว", `[${tag}] Thai success message`);
    await page.evaluate(() => {
      navigator.clipboard.writeText = () => Promise.reject(new Error("blocked"));
      document.execCommand = () => false;
    });
    await page.getByRole("button", { name: "คัดลอกลิงก์หน้านี้" }).click();
    await page.locator(".hub__status.is-failed").waitFor({ timeout: 2000 });
    ok(await page.locator(".hub__url").getAttribute("href") === "https://www.balenaroastery.com/shop", `[${tag}] clipboard blocked: error message plus a link to copy by hand`);
    await page.evaluate(() => { document.execCommand = () => true; });
    await page.getByRole("button", { name: "คัดลอกลิงก์หน้านี้" }).click();
    await page.locator(".hub__status.is-done").waitFor({ timeout: 2000 });
    ok(true, `[${tag}] older-browser fallback (execCommand) reports success`);

    // English.
    await page.getByRole("button", { name: "English" }).click();
    ok(norm(await page.locator("h1").innerText()) === "Shop Balena" && page.url().endsWith("/shop"), `[${tag}] English title, address unchanged`);
    const labels = await page.locator(".hub-row__link").evaluateAll((as) => as.map((a) => a.getAttribute("aria-label").split(":")[0]));
    ok(labels.join("|") === "Shop on Shopee|Shop on LINE|Chat on LINE|Visit Our Website|Open in Grab", `[${tag}] English link labels: ${labels.join(", ")}`);
    ok((await page.locator(".hub__group-h").allInnerTexts()).join("|") === "Shop & chat|Delivery", `[${tag}] English group headings`);
    await page.getByRole("button", { name: "Copy Page Link" }).click();
    await page.locator(".hub__status.is-done").waitFor({ timeout: 2000 });
    ok(norm(await page.locator(".hub__status").innerText()) === "Link copied", `[${tag}] English success message`);
    ok((await overflow(page)) <= 0, `[${tag}] no horizontal scroll`);
    await noBasket(page, tag);
    ok(page.errors.length === 0 && page.offsite.length === 0, `[${tag}] no errors or outside requests ${page.errors.join(" | ")}`);
    await page.screenshot({ path: `screenshots/site/${width}_en_shop_full.png`, fullPage: true });
    await page.getByRole("button", { name: "ภาษาไทย" }).click();
    await page.screenshot({ path: `screenshots/site/${width}_shop.png`, fullPage: true });
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
  ok(["/</loc>", "/products</loc>", "/shop</loc>", "/about</loc>"].every((s) => sitemap.includes(s)) && !sitemap.includes("trial") && !sitemap.includes("cost"), "[other] sitemap lists /, /products, /shop, /about only with public pages");
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
