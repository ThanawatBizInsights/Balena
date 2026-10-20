# Balena project handoff

State of the project when it moved to a new Claude account (October 2026). Read with
`CLAUDE.md` (standing rules) and `README.md` (setup and configuration).

## Where everything is

| Thing | Location |
|---|---|
| Code | https://github.com/ThanawatBizInsights/Balena, branch **`claude/cold-brew-recipes`** |
| Pull request | https://github.com/ThanawatBizInsights/Balena/pull/1 (not merged; `main` is still the "Initial commit") |
| Vercel project | `balena`, account `kraithanawat-2502` (Hobby) |
| Branch preview | https://balena-git-claude-cold-brew-recipes-kraithanawat-2502.vercel.app/cold-brew-recipes/ |
| Calculator preview | https://balena-git-claude-cold-brew-recipes-kraithanawat-2502.vercel.app/cost-calculator/ |
| Carrd site (original idea) | https://carrd.com/dashboard/build/fb6bf629ca66f06d (nothing built there; see below) |

Vercel preview URLs need a Vercel login (Deployment Protection: "all except custom domains").

## Commits on `claude/cold-brew-recipes`

1. `f90f6fd` Recipe page with Remotion animations.
2. `8d4f9e2` Fix for the blank Vercel deployment.
3. `57a4951` Cost and profit calculator page.
4. Handoff docs: this file and `CLAUDE.md`.

## 0. Earlier home page (now `/about`, Thai and English)

Brand introduction for roasted coffee beans and Cold Brew, ahead of selling online (Shopee,
LINE OA, Facebook). The layout follows a reference the owner shared: a large rounded dark hero
with the menu inside, a big headline bottom-left and a floating product card. Here the colours
are Balena's (deep-sea blue, whale blue, coffee brown, cream), the card shows the welcome poster,
and the whale sticker is stuck on its corner. The reference photo itself is not used.

Sections:
- **Hero:** "กาแฟดี ๆ ให้วันสดใส" / "Good coffee. Brighter days.", with buttons to the products and
  to the recipes page.
- **Products:** Cold Brew Concentrate Original 500 mL (banner image). Roasted beans are text only,
  with "details coming soon"; no bean photo, origins, roast levels or bag sizes have been
  supplied yet.
- **Signature drinks:** the four from the owner's poster.
- **Why a whale?:** Balena means "whale" in Italian.
- **Where to buy:** LINE OA, LINE SHOPPING, Shopee, Facebook. All are "coming soon" until the links
  are set in `site.channels`.

A TH/EN switch in the menu is remembered per browser. Text now lives in `src/shop/about-text.ts`, and the
brand images are in `public/images/`.

## 1. Recipe page `/cold-brew-recipes/`

The brief, in short: a mobile-first Thai page that teaches beginners to make drinks with the
concentrate, quickly, with quantities and strength adjustment. It opens from the LINE OA rich
menu.

Sections:

1. **Hero:** "ชงแก้วโปรดง่าย ๆ กับ Balena", subtitle, and a "เลือกเมนูที่อยากลอง" button that
   scrolls to the recipes. The product photo sits on a light-blue arch.
2. **Four recipe cards:** each card shows a ratio bar. Tapping one opens its ingredients, three
   steps, the starter-recipe note and an animation.

   | Menu | Liquids, in pour order | Other ingredients |
   |---|---|---|
   | กาแฟดำเย็น | Cold Brew 50 → water 100 | ice |
   | กาแฟนมเย็น | milk 100 → Cold Brew 50 | ice, syrup optional |
   | กาแฟโซดา | Cold Brew 50 → soda 100 (slowly) | ice |
   | กาแฟส้ม | orange juice 100 → Cold Brew 50 (slowly) | ice |

   These are starter recipes, not verified formulas, and are editable in `src/config/recipes.ts`.
3. **Animations:** 14 s at 30 fps. Stages: ingredients → ice → pour 1 → pour 2 → stir → finished
   drink → end card with "ปรับความเข้มได้ตามชอบ". Soda bubbles appear in กาแฟโซดา. Liquids pour
   from a plain jug, so the pouch is never drawn. The player loads lazily, never autoplays, and
   uses Thai play/pause/replay buttons. Reduced motion or a load failure shows a still picture.
4. **Strength:** "ชอบเข้มหรือเบา ปรับได้", with a note that ratios are liquid volumes before ice.
5. **Storage:** "เก็บอย่างไร", using only the wording the owner approved.
6. **Footer:** "สั่งซื้อ Balena Cold Brew" and "สอบถามวิธีชง" buttons. Their links come from
   `site.ts` and both are disabled until set.

The page HTML is pre-rendered at build time, so the text shows even without JavaScript.

## 2. Blank Vercel deployment: cause and fix

- **Cause:** the Vercel project had **no framework preset** and the repo had no `vercel.json`.
  Vercel therefore served the raw repo: `index.html` loaded `/src/main.tsx`, which browsers
  can't run, so the page was blank.
- **Second bug:** Vite's `base` (`/cold-brew-recipes/`) didn't match where the build put its
  files.
- **Fix:** `vercel.json` now sets framework Vite, `npm ci`, `npm run build` and output `dist`,
  with page rewrites (the `/` redirect was later replaced by the home page). The build layout matches the URLs, and the HTML is
  pre-rendered.
- **Verified:** Vercel built `8d4f9e2` and `57a4951` from Git and marked them Ready.
- **Not verified:** the previous session couldn't open the hosted pages; its sandbox blocked
  `*.vercel.app` and the Vercel connector had no access to this account's logs. **Check the
  preview URLs yourself first.** If a page is blank, open Deployment → Deploy Logs.

## 3. Cost calculator `/cost-calculator/`

Internal page for the owner's first batches.

**Owner's real figures:**
- Coffee: Basil Santos Coffee 100%, 375 g per batch.
- Water: 3 L per batch.
- Yield: **2.6 L** of concentrate, which fills 5 pouches of 500 mL with 100 mL left over. The
  grounds hold back 400 mL; the brew ratio is 1 : 8.
- Packaging: the pouch is ฿7 and the sticker is ฿2.

**Estimates, to replace with real receipts** (all in `src/cost/defaults.ts`):

| Item | Estimate | Counted per |
|---|---|---|
| Coffee price | ฿600/kg | batch |
| Water | 3 L × ฿1 | batch |
| Filter | ฿10 | batch |
| Cleaning | ฿5 | batch |
| Labour | 1.5 h × ฿50 | batch |
| Date/expiry label | ฿0.5 | pouch |
| Ice pack | ฿5 | order |
| Cool bag | ฿15 | order |
| Shipping | ฿40, off by default | order |
| Fridge electricity | ฿100 | month |
| Equipment wear | ฿250 | month |
| Samples and ads | ฿300 | month |
| LINE OA plan | ฿0 | month |
| Waste and tasting | 5% | of pouches made |
| Channel fees | 0% | of price |
| Selling price | ฿150 | pouch |
| Volume | 8 batches a month, 2 pouches per order | |

With these, a pouch costs about **฿104.05** and the profit is about ฿45.95 (30.6%).

**What the page shows:**
- a pouch graphic filled with each cost layer and the profit;
- the batch flow from beans to pouches;
- the hidden-cost checklist, where each item can be ticked off;
- monthly profit and the break-even number of pouches;
- prices for 30%, 40% and 50% profit;
- cost per cup, at 50 mL of concentrate per cup;
- a checklist of non-money items: food registration (อย.), shelf-life testing, VAT above
  ฿1.8M a year, keeping receipts.

Values the owner types are saved in that browser only.

## 4. Private price page `/price-check/`

Coffee bean list (10 beans, from the owner's `Coffee_List.zip`; label details read from the bag
photos) for the owner and partners to confirm details and set Siam and online prices. It shows
the % difference, the online net after fees, packing and shipping, the price that nets the Siam
price, and price per 100 g.

- **Access:** behind HTTP Basic login (`middleware.js`, `PRICE_CHECK_USERS`).
- **Storage:** shared through `api/price-check.js` and Upstash Redis.
- **Other copies:** a private claude.ai version exists at
  https://claude.ai/artifact/LCNmE7oLV4HpGUgEQUvDrD, and a standalone file is built into
  `tools/price-check/dist/`.
- **Label points to confirm:** Brazil Santos has the same details as Vino Rosso and no roast
  level; Brasil vs Brazil spelling; Muranga vs Murang'a; Wash vs Washed; missing origins.

## 5. Shop pages: home, catalogue, รู้จักเรา (branch `claude/product-showcase`)

The trial storefront design became the public site: `/` (home), `/products` (every product on
one page) and `/about` (the earlier home page's story). There is no basket or checkout; products
link out to Shopee, Lazada, LINE OA and Facebook once the links are added in
`src/config/purchase-links.ts`. Everything about it is in `docs/STOREFRONT.md`.

## Open items (owner to supply or decide)

1. **Product photo:** Balena Cold Brew Original 500 mL. Put it in `public/images/` and set
   `site.productImage` (path, width, height). Never crop or alter it.
2. **Four drink photos**, optional: set each recipe's `photo` in `src/config/recipes.ts`.
   Photos were mentioned before but never arrived.
3. **`links.order`:** the real LINE SHOP or shop URL. Also `site.channels` (LINE OA, LINE
   SHOPPING, Shopee, Facebook) for the home page.
4. **`links.ask`:** the real LINE OA chat URL (`https://line.me/R/ti/p/@…`).
5. **Beans:** photo, origins, roast levels, bag sizes and prices for the home page.
6. **Calculator inputs:** real coffee price and bag size, selling price, batches per month.
7. **Remotion licence status:** confirm Balena Roastery qualifies for the free licence (up to
   3 employees), or buy a company licence.
8. **Check the hosted preview** on a phone, inside LINE's in-app browser too.
9. **Merge PR #1** into `main` once the preview is approved.
10. **Production URL:** after merging, `/` is the home page; point the LINE rich menu at
   `https://<domain>/cold-brew-recipes/`. A custom domain bypasses preview protection.
11. **Carrd:** Carrd can't host this React/Remotion build. Either link to the Vercel URL, or on
    Carrd Pro embed it with an iframe. A direct link works better in LINE.
12. **Calculator visibility:** if the calculator should be private on production, add
    protection or move it off the public domain. It is `noindex` and unlinked, but reachable by
    URL.

## Decisions already made (don't revisit without the owner)

- **Standalone project:** this is its own repo, separate from CheckKhum.
- **Recipe page:** quantities live in one config file, and recipes are labelled as starters.
- **No pouch drawing:** the animations use a measuring jug, so the label is never redrawn.
- **Missing links:** buttons stay disabled until the owner gives real links; nothing invented.
- **No product claims:** no servings-per-pouch, shelf-life, caffeine or health claims on the
  customer page.
- **Calculator:** cost per cup appears only on the internal calculator.
- **Pre-rendered recipe page:** the recipe text must not depend on JavaScript.

## Starter prompt for the new account

> I'm continuing the Balena Roastery project in https://github.com/ThanawatBizInsights/Balena,
> branch `claude/cold-brew-recipes` (PR #1). Read `CLAUDE.md` and `docs/HANDOFF.md` first,
> then run `npm install`, `npm test` and `npm run build`. Next task: …
