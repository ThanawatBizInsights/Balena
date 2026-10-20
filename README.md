# Balena Cold Brew: วิธีชง (`/cold-brew-recipes`)

A mobile-first Thai recipe page for **Balena Cold Brew Concentrate Original 500 mL**. Customers
open it from the "วิธีชง Cold Brew" button in the LINE OA rich menu. It has four starter recipes,
each with a 14-second Remotion animation, plus strength and storage advice.

It is a static site built with React 19, TypeScript, Vite and Remotion Player.

New here, or a new Claude session? Read `CLAUDE.md` (rules) and `docs/HANDOFF.md` (history,
decisions, open items) first.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173/ (home), /products, /about, /cold-brew-recipes/, /cost-calculator/
npm run build        # typecheck, build and pre-render into dist/cold-brew-recipes/
npm run serve:dist   # serves dist/ with the vercel.json routing at http://localhost:4173/
```

Page check (Chromium at 390px and 1366px: Thai text, quantities, layout, buttons, player,
animation length, reduced motion). Writes screenshots to `screenshots/`:

```bash
npm run build && npm run serve:dist &
npm run check:page
PAGE_URL=https://<deployment>/cold-brew-recipes/ npm run check:page   # against a deployed copy
```

It also checks `/`, `/cold-brew-recipes` and a refresh, that every image loads, that no request
fails, that all four animations play, and that the recipes are readable with JavaScript off.

Animation contact sheet, for reviewing every recipe after an edit (dev server only):
`http://localhost:5173/dev/frames.html`

## Cost calculator (`/cost-calculator`)

An internal page for working out the real cost of one 500 mL pouch: coffee, the brewing
extras (water, filters, cleaning, your time), packaging, delivery, monthly costs and waste.
It shows profit per pouch and per month, how many pouches cover the monthly costs, prices
for a 30/40/50% margin, and the cost per cup.

- **Starting values:** these live in `src/cost/defaults.ts`. Your own numbers are marked
  "ตัวเลขจริง": 375 g Basil Santos Coffee 100%, 3 L water, 2.6 L yield, the 7-baht pouch and the
  2-baht sticker. Everything else is marked "ประมาณ" and needs replacing with real receipts,
  including the coffee price per kg and the selling price.
- **Your edits:** numbers typed on the page are kept in that browser only.
- **Maths:** the calculations are in `src/cost/calc.ts`, checked by `npm test`.
- **Visibility:** the page is `noindex` and nothing links to it, but anyone with the URL can
  open it once deployed.

```bash
npm test                 # calculation tests
npm run check:cost       # browser check at 390px and 1366px (needs npm run serve:dist)
```

## Coffee bean price check (`/price-check/`, login only)

A single HTML file for checking each coffee bean's name, photo, size, icon and label details,
and entering the Siam shop price and the online price. It shows the difference in %, what an
online sale leaves after platform fees, packing and shipping, the online price that leaves
the same as the Siam price, and price per 100 g. Entries stay in the browser that opened it;
it exports CSV (Excel), a LINE summary and a JSON backup.

On the website it lives at **balenaroastery.com/price-check/**, behind a login, and saves to a
shared database so the owner and partners see the same numbers (others' changes appear within
10 seconds). Nothing on the site links to it. One-time setup in Vercel (project `balena`):

1. **Storage → Create → Upstash (Redis), free plan → Connect to the `balena` project** (all
   environments). This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
2. **Settings → Environment Variables → `PRICE_CHECK_USERS`**, marked Sensitive, for Production
   and Preview, e.g. `owner:a-long-password,partner1:another-long-password`. One `name:password`
   per person, separated by commas. Change or remove a person by editing this value.
3. **Redeploy** so the new settings apply.

Until step 2 is done, everyone is refused. Until step 1 is done, the page works but only saves
in each person's browser, and says so.

The same page can also be sent as a file (`tools/price-check/dist/balena-price-check.html`, saves
in that browser) or opened on its private claude.ai link. To change the list, edit
`tools/price-check/products.json` (and the photos in `tools/price-check/images/`), then:

```bash
node tools/price-check/build.mjs   # rebuild the HTML file
node tools/price-check/check.mjs   # browser check at 390px and 1366px
npm run build && node tools/price-check/check-site.mjs   # login + shared saving, end to end
```

## What to edit

| File | What |
|---|---|
| `src/config/recipes.ts` | Recipe names, ingredients, quantities (ml), steps, pour order, captions, colours. The page text, card ratio bars and animations all read from here. |
| `src/config/site.ts` | Order link, "ask how to brew" link, product photo path and size. |
| `src/remotion/timeline.ts` | Animation length and the timing of each stage. |

### Still needed before going live

1. **Product photo.** No photo was attached to the request, so the hero shows a dashed frame. Put the
   file in `public/images/` (e.g. `balena-cold-brew-original-500ml.jpg`), then set
   `productImage.src`, `width` and `height` in `src/config/site.ts`. It is shown whole
   (`object-fit: contain`), never cropped or recoloured.
2. **Drink photos (optional).** Put them in `public/images/` and add a `photo` entry
   (`src`, `alt`, `width`, `height`) to each recipe in `src/config/recipes.ts`. They show above
   the ingredients.
3. **`links.order`**, the URL for "สั่งซื้อ Balena Cold Brew".
4. **`links.ask`**, the URL for "สอบถามวิธีชง" (probably the LINE OA chat link).

Until 3 and 4 are set, both buttons render disabled. In `npm run dev`, a yellow bar at the top
lists whatever is still missing. It never appears in the production build.

## How it works

- **Text first.** Ingredients, steps and notes are normal page text. The animation sits below
  them and only loads (`React.lazy`, about 100 kB gzipped) once its slot is within 300px of the
  screen. The first screen loads just the page bundle and fonts.
- **One animation system.** `RecipeScene` draws any frame from a recipe config. It is a pure
  function of the frame number, so the same code drives the Remotion composition, the player
  poster, the static fallback and the contact sheet. Stages (30 fps): ingredients 0–2.2s, ice
  2.2–3.8s, first pour 3.8–6.3s, second pour 6.3–8.8s, mixing 8.8–10.8s, finished drink
  10.8–12.2s, end card with "ปรับความเข้มได้ตามชอบ" 12.2–14s.
- **No pouch drawn.** Liquids pour from a plain measuring jug, so the product label is never
  redrawn or covered.
- **Controls.** Large Thai buttons (เล่นวิธีชง / หยุดชั่วคราว / เล่นต่อ / เล่นใหม่) drive the player.
  Nothing autoplays, and the player has no sound.
- **Reduced motion or load failure.** You get a still picture of the finished drink. With
  reduced motion there is also a button to open the animation anyway.
- **Pre-rendered.** `scripts/prerender.mjs` writes the page's HTML into `index.html` at build
  time, so the recipes show before JavaScript runs (or if it never does).
- **Route.** `vite.config.ts` sets `base: "/cold-brew-recipes/"` and builds into
  `dist/cold-brew-recipes/`, so file paths on the host match the URLs in the HTML.

## Hosting

**Vercel:** `vercel.json` sets everything, so no dashboard settings are needed:

- **Build settings:** framework Vite, install `npm ci`, build `npm run build`, output `dist`.
- **Routing:** `/` is the home page, `/products` the catalogue and `/about` the brand
  story; `/cold-brew-recipes` works with or without a trailing slash (including a refresh).
  Old `/trial/...` addresses redirect to the matching public page (see `docs/STOREFRONT.md`).
- **Root Directory:** leave empty, since the app is at the repo root.

**Other hosts:** serve the `dist/` folder as static files,
and point the LINE rich menu button at `https://<your-domain>/cold-brew-recipes/`.

**Carrd:** Carrd can't host a React/Remotion build directly. The options are (a) host `dist/`
elsewhere and link the Carrd button or LINE menu to it, or (b) on Carrd Pro, add an Embed
element with an `<iframe src="https://<your-domain>/cold-brew-recipes/">`. Option (a) is better
in LINE's in-app browser.

## Remotion licence

Remotion is free for individuals and companies with up to 3 employees. Larger for-profit
companies need a company licence (see `node_modules/remotion/LICENSE.md`). The player logs a
console note about this. Once you've confirmed your licence status, you can silence the note by
adding `acknowledgeRemotionLicense` to `<Player>` in `src/components/PlayerPanel.tsx`.

## Content rules followed

- Recipes are labelled as starter recipes ("สูตรเริ่มต้นสำหรับทดลองชง…") in every recipe view.
- Ratios refer to liquid volumes before ice.
- The page makes no claims about servings per pouch, shelf life, caffeine, nutrition or health.
- No links are invented.

## Translation checklist (every change to a public page)

Every public page must work in Thai and English (see the rule in `CLAUDE.md`). Before you
commit:

- [ ] New text is in `src/i18n/shop.ts`, `src/i18n/recipes-page.ts`, or a `{ th, en }` field in
      `src/data/products.ts` / `src/config/recipes.ts`, not typed into a component.
- [ ] Thai and English keys match, including alt text, `aria-label`s, page titles and meta
      descriptions.
- [ ] English is a faithful translation: no new facts, claims or prices. Brand and product names
      stay as they are.
- [ ] `npm test` passes (it includes `npm run check:i18n`).
- [ ] `npm run check:site` passes, and you looked at the page in both languages at 390px and
      desktop width: switch visible, nothing clipped (Thai tone marks), long English labels fit.
- [ ] Switching language keeps the address, selected product and section; the choice survives
      navigation and refresh.

