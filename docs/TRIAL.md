# Trial storefront (`/trial`)

A working trial of a new homepage, product browsing, product detail and ordering flow, kept
apart from the live pages for review. Branch: **`claude/trial-storefront`** (built on
`claude/cold-brew-recipes`). Nothing here is on production.

## Routes

| Route | Page |
|---|---|
| `/trial` | Homepage: hero, swipeable lineup, cold brew, coffee beans, coffee at home, order link |
| `/trial/order` (`?p=<slug>` selects a product) | Order page: category filter, product strip, big visual and buying panel |
| `/trial/products/<slug>` | Product detail for each product below |
| `/trial/cart` | Cart |
| `/trial/checkout` | Demo checkout ("ทดลองสั่งซื้อ — ยังไม่มีการเรียกเก็บเงินหรือส่งคำสั่งซื้อจริง") |
| `/trial/complete` | Demo completion screen |

Every trial page carries `<meta name="robots" content="noindex, nofollow">`, and Vercel adds an
`X-Robots-Tag: noindex` header (`vercel.json`). The repo has no sitemap, so there is nothing
to exclude there.

## Run it

```bash
npm install
npm run dev                  # http://localhost:5173/trial (any /trial/... address works)
npm run build && npm run serve:dist
TRIAL_ORIGIN=http://localhost:4173 npm run check:trial   # journey test at 390 / 768 / 1440 px
```

On Vercel, pushing the branch creates a preview deployment only:
`https://balena-git-claude-trial-storefront-kraithanawat-2502.vercel.app/trial`. It sits
behind Vercel login, like other previews.

## How it is built

- **Same stack as the site:** React 19, Vite multi-page, plain CSS. One more page entry,
  `trial/index.html`, with a small client-side router (`src/trial/router.tsx`).
  `vite.config.ts` (dev) and `vercel.json` (hosting) send every `/trial/...` address to it.
- **One product data source:** `src/trial/data/products.ts` holds ids and slugs, names,
  category, images and alt text, label facts, variants, prices, availability, accent colour,
  and a `gaps` list per product.
- **Cart:** `src/trial/state/cart.ts` is shared by all trial pages and saved in
  `localStorage` under `balena-trial-cart-v1`, a key no other page uses. It stores only
  product ids, variant ids and quantities. Totals are integer satang. Variants are separate
  lines, and lines whose price or variant is gone are flagged and left out of the total.
- **Demo checkout:** form details stay in component memory, so they are never stored or sent.
  There are no payment fields and no network calls (the test confirms no request leaves the
  site or hits `/api`). The demo order is held in memory, and the completion page says it
  is not a real order.
- **Fonts:** Archivo Black for English display words and Kanit 800 for Thai headlines, both
  OFL from Fontsource. Body text stays in Noto Sans Thai, as on the existing pages. Thai
  headline line-heights are at least 1.25, so vowels and tone marks aren't clipped.
- **Motion:** CSS only:
  - hero entrance and a slow pouch float;
  - gallery and product swaps;
  - a cart-count bump and toast;
  - confetti on completion.

  All of it is off under `prefers-reduced-motion`.

### Test prices (review only)

No prices are confirmed, so every product shows **"สอบถามราคา"** and can't be added to the cart.
To walk through cart and checkout anyway, switch on **"ใช้ราคาทดสอบ ฿100"** in the trial
footer, or open any trial page with `?test-prices=1`. Every unpriced item then costs ฿100
and is badged "ราคาทดสอบ" everywhere, including the receipt. The setting lasts for that
browser tab only; `?test-prices=0` turns it off. Real prices, once set in `products.ts`,
always win.

## Product-to-image mapping

Originals are kept unchanged in `assets/products-original/`. Web copies are in
`public/trial/products/<slug>-480.webp` and `-960.webp`: resized only, not cropped, with
transparency kept.

| Product (slug) | Source file | Notes |
|---|---|---|
| Cold Brew Concentrate, Smooth Black 500 mL (`cold-brew-concentrate-smooth-black`) | `Balena Cold Brew Spout Pouch.png` | Transparent cutout. Label carries "ชงง่ายที่บ้าน เข้มอร่อยได้ทุกเมนู". |
| Cold Brew Coffee, Original 500 mL (`cold-brew-coffee-original`) | `ChatGPT Image Sep 15, 2026, 12_52_34 PM (1).png` | Identified from the artwork: pouch labelled "Cold Brew COFFEE — Original, 500 mL". Photo with a café background, no cutout. |
| Brazil Santos (`brazil-santos`) | `Brasil Santos.png` | |
| Brazil Cerrado (`brazil-cerrado`) | `Brasil Cerrado.png` | |
| Laos Bolaven (`laos-bolaven`) | `Laos Bolaven.png` | |
| House Blends (`house-blends`) | `House Blends.png`, plus `ChatGPT Image Oct 15, 2026, 12_42_01 PM-1.png` | The generic file is the same House Blends 200 g bag on a white background, used as its second image. |
| Kenya Muranga (`kenya-muranga`) | `Kenya.png` | |
| Milk Choc (`milk-choc`) | `Milk Choc.png` | |
| Vino Rosso (`vino-rosso`) | `Vino Rosso.png` | |
| 52 Hz. Signature Blend (`52hz-signature-blend`) | `52 Hz.png` | |
| Blue Magic (`blue-magic`) | `Blue Magic.png` | |
| Whiskey (`whiskey`) | `Whiskey.png` | |

`__MACOSX` resource forks were ignored.

## Meta catalog (`catalog/meta-catalog.csv`)

Every product, in Meta's catalog template (Commerce Manager → Catalog → Data sources → upload
file). Built from `src/trial/data/products.ts` with `npm run catalog:meta`, so re-run it after
changing products or prices. One row per variant; `id` is `<slug>-<variant>` (e.g.
`brazil-santos-200g`).

- `image_link` points at `/catalog/<slug>.jpg`: JPG copies of the originals, uncropped, with
  cutouts placed on white (`python3 tools/catalog/make-images.py`).
- `link` and `image_link` use `https://balenaroastery.com` (`CATALOG_BASE` to change). They
  only work once this branch is on production, and `link` opens the trial product page, which
  still carries the trial ribbon.
- `price` is blank for every item, because no price is confirmed. Meta usually refuses
  items without a price, so add prices to `products.ts` first.
- `availability` is "in stock" for every item because each variant is marked available.
  Stock itself is not confirmed.
- `fb_product_category`, quantity, sale price, shipping, weight and GTIN are left empty
  (not known).

## Missing or unverified information

Nothing below was guessed. The page either leaves it out or shows "สอบถามราคา" or "ยังไม่ระบุ".

1. **Prices:** none for any product, so every item is "สอบถามราคา" with buying disabled. Add
   `price` (in satang) per variant in `products.ts`.
2. **Stock and availability:** not known. Every variant is marked available but can't be
   bought without a price.
3. **Bean grind options:** labels say "WHOLE BEAN COFFEE" only, so no grind selector. Add
   variants if ground coffee is sold.
4. **Bean sizes:** only the label sizes: 200 g (8 beans), 100 g (Blue Magic, Whiskey). No
   other sizes are offered.
5. **Cold brew line-up:** the current site sells "Cold Brew Concentrate Original 500 mL". The
   new images show two pouches:
   - "Cold Brew **Concentrate** — Smooth Black";
   - "Cold Brew **Coffee** — Original".

   Confirm whether these are two products, whether "Original" is ready-to-drink or a
   concentrate, and their prices.
6. **Original pouch cutout:** only a photo with a background exists. A transparent cutout
   would match the other products.
7. **Label inconsistencies** (as noted for the price check):
   - Brazil Santos shows no roast level and has the same process, altitude and notes as Vino
     Rosso;
   - "Brasil" vs "Brazil";
   - "Muranga" vs "Murang'a";
   - "Wash" vs "Washed" Process.
8. **Origins** of the blends and of Milk Choc, Vino Rosso, Blue Magic and Whiskey: not on
   the labels, so not shown.
9. **Dilution ratios and servings:** not shown on the trial. The coffee-at-home section links
   to the existing recipe page, which labels its ratios as starter recipes.
10. **Shipping cost:** unknown. The cart says "แจ้งเมื่อเปิดขายจริง" and adds nothing.
11. **Contact and sales channels:** `site.channels` and `links` are still empty, so the footer
    shows "เร็ว ๆ นี้".
12. **Logo file:** no standalone logo artwork was supplied, so the trial uses the same text
    wordmark as the live home page. Swap in the real logo file when available.

## Checks run

- **Script (`scripts/check-trial.mjs`):** all passing at 390, 768 and 1440 px:
  - no horizontal scroll, broken images or console errors on any trial page;
  - noindex present;
  - exact hooks and both hero CTAs;
  - gallery next button, keyboard ←/→, swipe and counter;
  - mobile menu;
  - unpriced items show "สอบถามราคา" and can't be added;
  - with test prices: product → detail → quantity → add (toast and count) → cart total ฿400;
    merged lines; quantity change to ฿300; turning test prices off flags lines and blocks
    checkout;
  - cart survives reload;
  - checkout: demo notice, no payment fields, name required, details not stored;
  - completion: DEMO reference and ฿300 total, cart emptied, "เลือกสินค้าต่อ" works;
  - unknown product shows not found;
  - no requests off the site or to `/api`;
  - reduced motion turns the hero animation off;
  - `/`, `/cold-brew-recipes/` and `/cost-calculator/` still served without the trial.
- **Existing checks:** `npm test`, typecheck and build, `check:page`, `check:cost`,
  `check:home`, and `tools/price-check/check-site.mjs` all pass.
- **Screenshots:** `screenshots/trial/` (390 / 768 / 1440 px, every trial page plus filled
  cart, checkout and completion).

## Remaining issues

- **Hosted preview:** not checked from here. This environment can't open `*.vercel.app`, and
  previews need a Vercel login.
- **Real devices:** swipe was tested by scrolling the gallery in Chromium, not on an iPhone or
  inside LINE's in-app browser.
- **Hero text:** the oversized "COLD BREW" sits partly behind the pouch by design, as in the
  reference. The real headline is the Thai hook below it.
