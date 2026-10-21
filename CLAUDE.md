# Balena Roastery website: project instructions

Balena Roastery sells cold brew (500 mL pouches) and roasted coffee beans. The site is a product
showcase: it sends customers to Shopee, LINE SHOP, Lazada, LINE OA, Facebook and Grab to buy. There is no basket
or checkout on the site. Copy is Thai; the audience is on phones, mostly inside LINE's in-app
browser. Every public page is in Thai and English (TH / EN switch in the header).

| Route | What | Audience |
|---|---|---|
| `/` | Home: cold brew hero, cold brew, coffee beans, brand intro, contact | Customers |
| `/products` | Catalogue: every product on one page, cold brew (`#cold-brew`) then beans (`#coffee-beans`); `?p=<slug>` selects a product | Customers |
| `/shop` | เลือกช่องทางสั่งซื้อ / Shop Balena: a link-in-bio style page, every shopping and contact channel as one grouped list of rows, plus a share (copy link) button. Shared on social media and by QR code. | Customers |
| `/about` | รู้จักเรา: brand story, signature drinks | Customers |
| `/cold-brew-recipes/` | How to make four drinks with the concentrate, with Remotion animations. Opened from the "วิธีชง Cold Brew" button in the LINE OA rich menu. | Customers |
| `/cost-calculator/` | Cost, yield, hidden costs and profit per pouch. `noindex`, not linked from anywhere. | Owner only |
| `/price-check/` | Coffee bean details and prices (Siam vs online), saved for everyone signed in. **Behind a login** (`middleware.js`). | Owner and partners |

Read `docs/HANDOFF.md` for history, decisions and open items.

## Stack and commands

React 19 · TypeScript 7 (strict) · Vite 8 (multi-page, `base: "/"`) · Remotion 4.0.534
(`remotion` and `@remotion/player`, pinned to the same exact version) · Noto Sans Thai
(`@fontsource`) · plain CSS · Playwright for checks. Node ≥ 20.19.

```bash
npm install
npm run dev          # http://localhost:5173/, /products, /shop, /about, /cold-brew-recipes/, /cost-calculator/
npm test             # cost calculation tests (src/cost/calc.test.ts) + translation check
npm run check:i18n   # every Thai/English key, product and recipe text present in both languages
npm run build        # typecheck, translation check, build to dist/, pre-render the public pages
npm run serve:dist   # serve dist/ with the vercel.json routing on :4173
npm run check:page   # recipe page in Chromium at 390px and 1366px (needs serve:dist)
npm run check:cost   # cost calculator in Chromium at 390px and 1366px (needs serve:dist)
npm run check:site   # /, /products, /shop, /about, 404, redirects, Thai and English, 390/768/1440px (needs serve:dist; SITE_ORIGIN)
node tools/price-check/check-site.mjs   # /price-check/ login + shared saving, end to end (after build)
npm run catalog:meta # Meta (Facebook/Instagram) catalog CSV from the product data → catalog/meta-catalog.csv
```

Run `npm test`, `npm run build`, then all the checks before every commit. In a cloud container with
Chromium at `/opt/pw-browsers/chromium`, the check scripts use it automatically. Never run
`playwright install` there.

## Where things live

| Path | What |
|---|---|
| `src/config/recipes.ts` | **Recipe quantities, steps, pour order, colours.** Page text, card ratio bars and animations all read from here. |
| `src/config/site.ts` | **Site address (canonical/sitemap), recipe page order and ask links, product photo** |
| `src/data/products.ts` | **All product data** (one source for home, catalogue and Meta catalog). Leave unconfirmed fields out. |
| `src/config/purchase-links.ts` | **Every channel URL** (Shopee, LINE SHOP, LINE OA, Grab, Facebook, Lazada): store link per channel, `/shop` card order, `COMING_SOON` rows, which channels sell catalogue products, optional link per product (product wins). Empty = no button. URLs are used exactly as pasted. |
| `src/shop/` | Home, catalogue, shop-channels, about and 404 pages (`HomePage`, `CatalogPage`, `ShopPage`, `AboutPage`, `NotFoundPage`), shared header/footer/buttons (`ui.tsx`), link rules (`channels.ts`), styles (`shop.css`) |
| `src/i18n/lang.ts` | **The language system**: `useLang()`, `setLang()`, saved choice (`balena-lang`), `<html lang>`/title/meta, no-flash boot script |
| `src/i18n/shop.ts` | **All shop page text (home, catalogue, about, 404, header, footer, buttons), Thai and English** |
| `src/i18n/recipes-page.ts` | **All recipe page text, Thai and English** (recipes themselves are in `src/config/recipes.ts`) |
| `scripts/check-i18n.mjs` | Translation check: missing keys, empty values, Thai left in English, hard-coded Thai in components |
| `index.html`, `products/index.html`, `shop/index.html`, `about/index.html`, `404.html` | Shop page entries: Thai titles, descriptions, canonical URLs (English set at runtime) |
| `public/sitemap.xml`, `public/robots.txt` | Sitemap of the public pages |
| `public/images/balena-*.webp` | Owner-supplied brand artwork: welcome poster, banner, signature drinks poster, whale sticker. Use whole and unaltered. |
| `src/remotion/` | `RecipeScene` draws any frame (a pure function of the frame number), `RecipeComposition` wraps it for Remotion, `timeline.ts` sets stage timings (30 fps, 14 s) |
| `src/components/` | Recipe page sections; `PlayerPanel` (lazy-loaded player), `RecipeAnimation` (lazy slot, still fallback) |
| `src/entry-server.tsx`, `src/shop/entry-server.tsx`, `scripts/prerender.mjs` | Build-time HTML pre-render of the shop pages and the recipe page (readable without JS) |
| `src/cost/calc.ts` | Cost maths (pure). `calc.test.ts` checks it against hand-worked numbers. |
| `src/cost/defaults.ts` | **Calculator starting values.** Owner's real figures are `source: "yours"`; the rest are `"estimate"`. |
| `src/cost/CostApp.tsx`, `cost.css` | Calculator UI |
| `cold-brew-recipes/index.html`, `cost-calculator/index.html` | Other page entries |
| `vercel.json` | Build settings, routing and old `/trial` redirects for Vercel (overrides the dashboard preset) |
| `middleware.js`, `lib/price-check-auth.js` | Login (HTTP Basic) for `/price-check/` and `/api/price-check`. Logins in the `PRICE_CHECK_USERS` env var (`name:password,name:password`); missing = everyone refused. |
| `api/price-check.js` | Shared storage for the price page: one Redis hash in Upstash (Vercel Marketplace; `KV_REST_API_URL`/`KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_*`). |
| `tools/price-check/` | Price page source: `products.json` (list, label details, flags), `template.html`, `build.mjs` (`--site` writes `dist/price-check/`), `check.mjs`, `check-site.mjs` |
| `public/images/channels/`, `assets/channel-logos/` | Platform logos for `/shop` (owner-supplied, unaltered; web copies and originals) |
| `public/images/products/`, `assets/products-original/` | Product web images (480/960 webp), unchanged originals |
| `tools/catalog/`, `catalog/meta-catalog.csv`, `public/catalog/*.jpg` | Meta catalog: template header, builder, output, JPG images (`make-images.py`) |
| `dev/frames.html` | Dev-only contact sheet of every animation's key frames: `/dev/frames.html` |

## Rules

- **Never invent facts or links.** No guessed URLs, shelf life, caffeine, nutrition, health
  claims, servings per pouch, prices or certifications on the customer page. Empty
  `links.order` / `links.ask` render as disabled buttons; that is intended until the owner
  supplies the real URL.
- **Recipes are starter recipes**, not official formulas. Keep the note "สูตรเริ่มต้นสำหรับทดลองชง
  สามารถปรับสัดส่วนตามรสชาติที่ชอบ" in every recipe view. Ratios are liquid volumes before ice.
- **Product imagery:** use only photos the owner supplies, unaltered and never cropped
  (`object-fit: contain`). Never redraw the pouch label or logo. The animations pour from a
  plain measuring jug for this reason; if the pouch is ever shown pouring, its cap comes off
  first and liquid leaves the spout. Only use supplied Balena (whale) character art; never
  invent one.
- **Brand palette:** recipe and calculator pages use cream `#FBF5EA`, ocean blue `#145A8C`,
  coffee brown `#5B3A24`, light blue `#D6EAF6` (tokens in `src/styles.css`). The shop pages
  (`/`, `/products`, `/about`) use navy `#0A1F4D`, ocean `#1D5FD6`, cream `#FBF3E4`, coffee
  `#3B2214`, spray `#CFE5FF` plus each product's label colour as its accent (tokens in
  `src/shop/shop.css`). Headings there use Archivo Black (English) and Kanit (Thai).
- **Shop pages:** a showcase, not a shop. No basket, quantities, prices, checkout or payment
  forms. Purchase buttons come only from `src/config/purchase-links.ts` through
  `src/shop/channels.ts`: a missing link means no button (never a disabled or `#` link); with
  no links at all the page says "ช่องทางสั่งซื้อจะอัปเดตเร็ว ๆ นี้". External links open in a
  new tab with `rel="noopener noreferrer"`. Facebook and LINE are chats: don't imply payment
  there. Show only confirmed product fields (no empty rows), never invent origins, notes,
  prices, stock, shelf life or claims, and don't emit Product offers or ratings in structured data.
- **Shopping-channel page (`/shop`):** On the shopping-channel page, each channel card must
  contain no more than two visible text lines at standard text size: one platform name and one
  concise description. Maintain complete Thai/English support and preserve accessibility when
  text is enlarged. (Text: `hub.cards` in `src/i18n/shop.ts`, with a `short` line for screens
  under 360px; logos: `CHANNEL_LOGOS` in `src/config/purchase-links.ts`, files in
  `public/images/channels/`, originals in `assets/channel-logos/`, shown whole with
  `object-fit: contain`. `npm run check:site` measures the lines.)
- **Catalogue addresses:** `/products?p=<slug>#<cold-brew|coffee-beans>` must keep working (also
  the old `?p=` links). Keep slugs stable; Meta catalog links use them.
- **Thai and English (permanent rule):** Every public Balena Roastery page and customer-facing
  feature must support both Thai and English. This applies to new pages, redesigns, shared
  components, navigation, product information, buttons, status messages, accessibility text
  and SEO metadata. Use the shared translation system and provide matching Thai/English keys.
  Preserve the global language selector and the visitor's selected language across
  navigation. A change is incomplete until both languages have been checked on desktop and
  mobile. The approved bilingual hero slogans may appear together intentionally. Brand names
  and product names may remain unchanged.
  - How, in this repo: text goes in `src/i18n/*.ts` (or `{ th, en }` fields in
    `src/data/products.ts` / `src/config/recipes.ts`), never inline in components; read it with
    `useText()` / `usePageText()`; `npm run check:i18n` must pass (it runs in `npm test` and
    `npm run build`). Thai is the default and the pre-rendered language; the TH / EN switch
    changes language in place (address, product and section stay) and the choice is saved as
    `balena-lang`. There are no per-language URLs, so publish no `hreflang` links. Translate
    meaning, never add facts. The owner-only tools (`/cost-calculator/`, `/price-check/`) and
    the dev-only `ConfigNotice` are not public pages and stay Thai.
- **No unconfirmed claims:** no reviews, ratings, prices, awards or origin claims until the
  owner confirms them, in either language.
- **Thai readability:** Noto Sans Thai, body ≥ 17px at line-height ≥ 1.7, nothing below 15px,
  no letter-spacing on Thai. Keep "ๆ" off the start of a line (use a non-breaking space
  before it, as in the hero heading).
- **Mobile and accessibility:** design for 390px first. No horizontal scroll, touch targets
  ≥ 44px, visible focus, `prefers-reduced-motion` respected (still picture plus opt-in
  button), recipe text readable without JavaScript.
- **Animations:** no autoplay, no sound. Play, pause and replay use our own Thai buttons
  (Remotion's built-in controls are off). Replay must pause before seeking (see
  `PlayerPanel.replay`). Check `/dev/frames.html` after changing `recipes.ts` or the scene.
- **Cost calculator:** keep estimates badged "ประมาณ" and owner figures badged "ตัวเลขจริง".
  What users type is saved only in their browser (`localStorage`). Every maths change goes
  with a test in `calc.test.ts`. Chart colours were checked for colour-blind safety on the
  cream background; re-check if you change them.
- **Remotion licence:** free for individuals and companies with up to 3 employees; larger
  for-profit companies need a company licence. Don't add `acknowledgeRemotionLicense` until
  the owner confirms their status.
- **Private price page:** never remove `/price-check` or `/api/price-check` from the middleware
  matcher, never put logins or Redis tokens in the repo, and never link the page from public
  pages. The API re-checks the login itself and only accepts known paths.
- **Git:** work on a branch and open a pull request; leave `main` for reviewed work.
- **Separate project:** this repo has nothing to do with the CheckKhum project. Never copy
  code, links or settings between them.
