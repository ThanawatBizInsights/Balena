# Balena Roastery website: project instructions

Balena Roastery sells **Balena Cold Brew Concentrate Original 500 mL** (stand-up pouch with a
spout) and roasted coffee beans. This repo holds four pages plus a trial storefront. Copy is Thai; the audience is on phones, mostly inside LINE's
in-app browser.

| Route | What | Audience |
|---|---|---|
| `/` | Brand home page in Thai and English (switch in the menu): hero, products, signature drinks, whale story, where to buy | Customers |
| `/cold-brew-recipes/` | How to make four drinks with the concentrate, with Remotion animations. Opened from the "วิธีชง Cold Brew" button in the LINE OA rich menu. | Customers |
| `/cost-calculator/` | Cost, yield, hidden costs and profit per pouch. `noindex`, not linked from anywhere. | Owner only |
| `/price-check/` | Coffee bean details and prices (Siam vs online), saved for everyone signed in. **Behind a login** (`middleware.js`). | Owner and partners |
| `/trial/...` | Trial storefront redesign (home, order, product pages, cart, demo checkout). `noindex`, branch `claude/trial-storefront` only. See `docs/TRIAL.md`. | Owner review |

Read `docs/HANDOFF.md` for history, decisions and open items.

## Stack and commands

React 19 · TypeScript 7 (strict) · Vite 8 (multi-page, `base: "/"`) · Remotion 4.0.534
(`remotion` and `@remotion/player`, pinned to the same exact version) · Noto Sans Thai
(`@fontsource`) · plain CSS · Playwright for checks. Node ≥ 20.19.

```bash
npm install
npm run dev          # http://localhost:5173/, /cold-brew-recipes/ and /cost-calculator/
npm test             # cost calculation tests (src/cost/calc.test.ts)
npm run build        # typecheck, build to dist/, pre-render the recipe page HTML
npm run serve:dist   # serve dist/ with the vercel.json routing on :4173
npm run check:page   # recipe page in Chromium at 390px and 1366px (needs serve:dist)
npm run check:cost   # cost calculator in Chromium at 390px and 1366px (needs serve:dist)
npm run check:home   # home page, Thai and English, at 390px and 1366px (needs serve:dist)
node tools/price-check/check-site.mjs   # /price-check/ login + shared saving, end to end (after build)
npm run catalog:meta # Meta (Facebook/Instagram) catalog CSV from the trial product data → catalog/meta-catalog.csv
npm run check:trial  # trial storefront journey at 390/768/1440 (needs serve:dist; TRIAL_ORIGIN to override)
```

Run `npm test`, `npm run build`, then all three checks before every commit. In a cloud container with
Chromium at `/opt/pw-browsers/chromium`, the check scripts use it automatically. Never run
`playwright install` there.

## Where things live

| Path | What |
|---|---|
| `src/config/recipes.ts` | **Recipe quantities, steps, pour order, colours.** Page text, card ratio bars and animations all read from here. |
| `src/config/site.ts` | **Order and contact links, sales channels (LINE OA, LINE SHOPPING, Shopee, Facebook), product photo** |
| `src/home/i18n.ts` | **All home page text, Thai and English** (same keys in both) |
| `src/home/HomeApp.tsx`, `home.css` | Home page UI and styles |
| `public/images/balena-*.webp` | Owner-supplied brand artwork: welcome poster, banner, signature drinks poster, whale sticker. Use whole and unaltered. |
| `src/remotion/` | `RecipeScene` draws any frame (a pure function of the frame number), `RecipeComposition` wraps it for Remotion, `timeline.ts` sets stage timings (30 fps, 14 s) |
| `src/components/` | Recipe page sections; `PlayerPanel` (lazy-loaded player), `RecipeAnimation` (lazy slot, still fallback) |
| `src/entry-server.tsx`, `src/home/entry-server.tsx`, `scripts/prerender.mjs` | Build-time HTML pre-render of the home (Thai) and recipe pages (readable without JS) |
| `src/cost/calc.ts` | Cost maths (pure). `calc.test.ts` checks it against hand-worked numbers. |
| `src/cost/defaults.ts` | **Calculator starting values.** Owner's real figures are `source: "yours"`; the rest are `"estimate"`. |
| `src/cost/CostApp.tsx`, `cost.css` | Calculator UI |
| `index.html`, `cold-brew-recipes/index.html`, `cost-calculator/index.html` | Page entries |
| `vercel.json` | Build settings and routing for Vercel (overrides the dashboard preset) |
| `middleware.js`, `lib/price-check-auth.js` | Login (HTTP Basic) for `/price-check/` and `/api/price-check`. Logins in the `PRICE_CHECK_USERS` env var (`name:password,name:password`); missing = everyone refused. |
| `api/price-check.js` | Shared storage for the price page: one Redis hash in Upstash (Vercel Marketplace; `KV_REST_API_URL`/`KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_*`). |
| `tools/price-check/` | Price page source: `products.json` (list, label details, flags), `template.html`, `build.mjs` (`--site` writes `dist/price-check/`), `check.mjs`, `check-site.mjs` |
| `src/trial/data/products.ts` | **Trial storefront product data** (one source; prices null until confirmed) |
| `src/trial/`, `trial/index.html`, `public/trial/products/`, `assets/products-original/` | Trial app, its entry, web images, unchanged originals |
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
  coffee brown `#5B3A24`, light blue `#D6EAF6` (tokens in `src/styles.css`). The home page uses
  the brighter colours of the brand artwork: whale blue `#1D5FD6`, deep sea `#0B2E6E`, coffee
  `#4A2614`, cream, spray blue `#D7EBFB` (tokens in `src/home/home.css`). Headings there use
  Fredoka (English) and Mitr (Thai). Keep it clean and friendly, with little motion.
- **Bilingual home page:** every visible string lives in `src/home/i18n.ts` in both languages.
  Thai is the default and the pre-rendered language; the choice is saved in `localStorage` and
  sets `<html lang>`. No reviews, ratings, prices, awards or origin claims until the owner
  confirms them. Sales channels with empty links show "เร็ว ๆ นี้ / Coming soon".
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
- **Trial storefront:** never invent prices; unpriced items show "สอบถามราคา". Checkout is a
  demo: no network calls, no personal data in storage, no payment fields. Cart key
  `balena-trial-cart-v1` only.
- **Git:** work on a branch and open a pull request; leave `main` for reviewed work.
- **Separate project:** this repo has nothing to do with the CheckKhum project. Never copy
  code, links or settings between them.
