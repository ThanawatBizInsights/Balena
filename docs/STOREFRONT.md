# Shop pages: home, catalogue, รู้จักเรา

The public site is a product showcase that sends customers to Shopee, Lazada, LINE OA and
Facebook. It grew out of the trial storefront (`/trial`, branch `claude/trial-storefront`);
the basket, demo checkout and completion screens were removed.

## Languages

Every page is in Thai and English. The TH / EN switch sits in the header on every page,
the recipe page included.

- **First visit:** Thai.
- **Choosing:** a visitor's choice is saved (`balena-lang`) and follows them across pages and refreshes.
- **Address:** switching changes the text in place, so the address, the selected product and
  the section stay as they are.
- **No flash:** for a saved English choice the pre-rendered Thai page stays hidden (at most
  1.5 s) until it has switched.
- **Where the text lives:** `src/i18n/` and the `{ th, en }` fields in the product and recipe
  data.
- **Check:** `npm run check:i18n` reports any gap.
- **Not translated:** product names, label values (taste notes, process, altitude) and
  platform names stay as printed.
- **Hero:** both approved slogans always show. The visitor's language is the headline.
- **404:** a bilingual page at `404.html`.

## Routes

| Route | Page |
|---|---|
| `/` | Home: 1. hero with the cold brew pouch, 2. cold brew, 3. roasted coffee beans, 4. brand intro linking to รู้จักเรา, 5. ติดต่อเรา (`#contact`) and footer |
| `/products` | Catalogue: all products on one page. Cold brew first (`#cold-brew`), beans below (`#coffee-beans`). |
| `/products?p=<slug>` | Opens the catalogue with that product selected and scrolls to its section. Unknown slugs fall back to the first product. |
| `/shop` | เลือกช่องทางสั่งซื้อ / Shop Balena: one card per channel (Shopee, LINE SHOP, LINE OA, this website, Grab Delivery Bang Yai) and a "copy page link" button that copies `https://www.balenaroastery.com/shop`. Made for social posts and QR codes. |
| `/about` | รู้จักเรา: the earlier home page's story, products intro, signature drinks and artwork (Thai/English switch) |

Main menu: หน้าแรก `/` · สินค้าของเรา `/products` · รู้จักเรา `/about` · ติดต่อเรา `#contact`. Every page
ends with the contact section.

### Old addresses

`vercel.json` redirects the trial addresses (307, so they can change later):

| Old | New |
|---|---|
| `/trial` | `/` |
| `/trial/order?p=<slug>` | `/products?p=<slug>` (the query is kept) |
| `/trial/products/<slug>` | `/products?p=<slug>` |
| `/trial/cart`, `/trial/checkout`, `/trial/complete` | `/products` |
| any other `/trial/...` | `/` |

Anchors from the old pages are mapped in the browser: `/#beans` → `#coffee-beans`, `/#buy` →
`#contact`, `/#story` and `/#drinks` → `/about#…`, `/#products` → `/products`.

## Run it

```bash
npm install
npm run dev                         # http://localhost:5173/, /products, /about
npm run build && npm run serve:dist # the built site with vercel.json routing, :4173
npm run check:site                  # browser check at 390 / 768 / 1440 px
```

## Platform buttons

Outside `/shop`, purchase and contact buttons are compact pills: the platform's logo (from
`CHANNEL_LOGOS`) and its name, one line each, in the platform colour. The colours are deepened
slightly so white text stays readable at 4.5:1:

| Platform | Colour |
|---|---|
| Shopee | `#D73E1B` |
| Lazada | `#D3105F` → `#4B39EF` gradient |
| LINE SHOP and LINE OA | `#047A39` |
| Facebook | `#1466D8` |
| Grab | `#00874A` |

The full action ("ซื้อผ่าน Shopee: …") stays in each button's accessible label. `/shop` has its
own two-line rows.

## Adding purchase links

All links live in **`src/config/purchase-links.ts`**:

- `storeLinks`: your shop or chat page on each channel (`shopee`, `lineShop`, `lineOA`, `grab`,
  `facebook`, `lazada`). Used by the `/shop` cards and ติดต่อเรา. The channels in
  `PRODUCT_CHANNELS` (all but Grab) also fill every product without its own link.
  Set now: Shopee, LINE SHOP, Lazada, LINE OA, Facebook and Grab Delivery (Bang Yai).
- `CHANNEL_LOGOS`: the logo shown on each `/shop` row:
  - Shopee: `Shopee_logo.svg`;
  - LINE OA: `LINE_logo.svg`;
  - LINE SHOP: the LINE MyShop app icon (`app-icon.png`);
  - Lazada: `Lazada.avif`, converted to PNG;
  - Grab: `Grab.png` (GrabFood), also used for both Grab branches;
  - Website: the whale sticker;
  - Facebook: the supplied Facebook logo.

  Originals are in `assets/channel-logos/`.
- `grabCharoenKrung`: the Charoen Krung branch row. It is listed in `COMING_SOON`, so it shows
  as a plain "เร็ว ๆ นี้ / Coming soon" row with no link. When the branch is live, paste its Grab
  share link and remove it from `COMING_SOON`.
- `SHOP_HUB`: the groups and order of the `/shop` rows (`website` is this site's home page). Facebook and Lazada rows appear by themselves once their URLs are set.
- `productLinks`: a link to one product's own listing, by slug. It wins over the store link
  for that channel.

Example: Brazil Santos on Shopee and Lazada, plus the LINE OA chat for everything:

```ts
export const storeLinks: Record<Channel, string> = {
  shopee: "",
  facebook: "",
  lineOA: "https://line.me/R/ti/p/@yourid",
  lazada: "",
};

export const productLinks = {
  "brazil-santos": {
    shopee: "https://shopee.co.th/your-santos-listing",
    lazada: "https://www.lazada.co.th/products/your-santos-listing.html",
  },
};
```

Brazil Santos then shows ซื้อผ่าน Shopee, ซื้อผ่าน Lazada and สั่งซื้อผ่าน LINE OA. Every other product
shows สั่งซื้อผ่าน LINE OA only.

Rules (in `src/shop/channels.ts`):
- Only `https://` addresses count. An empty or invalid value shows no button.
- With no usable link, the page shows "ช่องทางสั่งซื้อจะอัปเดตเร็ว ๆ นี้" and nothing clickable.
- Links open in a new tab with `rel="noopener noreferrer"`.
- LINE OA and Facebook are labelled as chats ("ทักแชทเพื่อสั่งซื้อหรือสอบถาม"), so nothing
  implies payment happens there.

Product slugs: `cold-brew-concentrate-smooth-black`, `cold-brew-coffee-original`,
`brazil-santos`, `brazil-cerrado`, `laos-bolaven`, `house-blends`, `kenya-muranga`, `milk-choc`,
`vino-rosso`, `52hz-signature-blend`, `blue-magic`, `whiskey`.

## Product data

`src/data/products.ts` is the single source for the home page, the catalogue and the Meta catalog
CSV (`npm run catalog:meta`).

- **Optional fields:** `notes`, `roast`, `process`, `altitude`, `form`, `type`, `flavour` and
  `use` are optional. A field left out shows no row; nothing displays "ยังไม่ระบุ".
- **Gaps:** `gaps` lists what still needs confirming. It is never shown on the site.

Images:
- **Web copies:** `public/images/products/<slug>-480.webp` and `-960.webp`, uncropped with
  transparency kept.
- **Originals:** `assets/products-original/`.

### Product-to-image mapping

| Product (slug) | Source file |
|---|---|
| Cold Brew Concentrate, Smooth Black 500 mL (`cold-brew-concentrate-smooth-black`) | `Balena Cold Brew Spout Pouch.png` |
| Cold Brew Concentrate, Original 500 mL (`cold-brew-coffee-original`) | `Balena Cold Brew Café Pouch.webp` (owner's "Balena Cold Brew Café Pouch.png", received as a chat copy, 1122 × 1402; label reads Cold Brew CONCENTRATE · Original · 500 mL). Served as `cold-brew-concentrate-original-480/960.webp`. Replaced the earlier café photo whose label read "Cold Brew Coffee". |
| Brazil Santos | `Brasil Santos.png` |
| Brazil Cerrado | `Brasil Cerrado.png` |
| Laos Bolaven | `Laos Bolaven.png` |
| House Blends | `House Blends.png`, plus `ChatGPT Image Oct 15, 2026, 12_42_01 PM-1.png` as a second photo |
| Kenya Muranga | `Kenya.png` |
| Milk Choc | `Milk Choc.png` |
| Vino Rosso | `Vino Rosso.png` |
| 52 Hz. Signature Blend | `52 Hz.png` |
| Blue Magic | `Blue Magic.png` |
| Whiskey | `Whiskey.png` |

## Product positioning (from `docs/content/coffee-positioning.csv`)

The owner's positioning sheet is the source for each product's status, size, tasting notes,
story, recommended drinks, and process and roast details. Everything is kept in
`src/data/products.ts` in Thai and English. The CSV's positioning and difference columns are
stored under `internal` and used to write the "เหมาะกับใคร / Who it's for" line; they are never
shown word for word. `npm run check:products` maps every CSV row to exactly one product,
using the CSV name or a known spelling:

| CSV | Slug (unchanged) | Spellings recognised | Operations item |
|---|---|---|---|
| Brazil Santos · Brazil Cerrado | `brazil-santos` · `brazil-cerrado` | Brasil … | BN-SANTOS-200 · BN-CERRADO-200 |
| Laos Bolaven | `laos-bolaven` | Lao Bolaven | BN-BOLAVEN-200 |
| Milk Choc | `milk-choc` | | BN-MILKCHOC-200 |
| House Blend | `house-blends` | House Blends | BN-HOUSE-200 |
| 52 Hz. Signature Blend | `52hz-signature-blend` | 52 Hz. | BN-52HZ-200 |
| Kenya Muranga | `kenya-muranga` | Kenya Murang'a | BN-KENYA-200 |
| Blue Magic · Whiskey · Vino Rosso (100 g) | `blue-magic` · `whiskey` · `vino-rosso` | Whisky | BN-BLUEMAGIC-100 · BN-WHISKEY-100 · BN-VINO-100 |
| Florange | `florange` (new) | | BN-FLORANGE-200 |
| Ethiopia Gediyo (100 g) | `ethiopia-gediyo` (new) | Etiopia Gediyo | none (BN-GEDIYO-200 is the separate 200 g variant) |
| Colombia Supremo | `colombia-supremo` (new) | | none yet |
| Robusta (150 g) | `robusta` (new) | | BN-ROBUSTA-150 |
| Original · Smooth Black | `cold-brew-coffee-original` · `cold-brew-concentrate-smooth-black` | | CB-ORIGINAL-500 · CB-SMOOTH-500 |
| Fruity · Orange · Vanilla (planned) | `cold-brew-fruity` · `cold-brew-orange` · `cold-brew-vanilla` (unpublished) | | none |

The operations items keep their own names (e.g. "Etiopia Gediyo 200 g", "House Blends 200 g")
because sales records refer to them. Dark Orange 200 g and Brazil Cold Brew (bottle) exist
in operations (ICONSIAM) but are not in the CSV, so they are not on the site.

**Product photos needed:** Florange, Ethiopia Gediyo, Colombia Supremo, Robusta, and the three
planned cold brews. These show a plain "ยังไม่มีรูปสินค้า / Photo coming soon" placeholder and are
left out of the Meta catalog until a photo exists.

## Missing or unverified information

0. **Conflicts with the positioning sheet:**
   - **Ethiopia Gediyo size:** the CSV says 100 g. Operations has BN-GEDIYO-200 (200 g,
     unconfirmed) with an ICONSIAM sale. That item is unchanged; the site shows 100 g.
   - **Vino Rosso photo:** the bag reads NET WT 200 G and prints Brazil Santos' details
     (Natural · 800–1,300 masl. · Brown sugar, Chocolate, Hazelnut). The CSV and operations
     say 100 g, Red Honey, red grape/floral. The text follows the CSV; the photo needs replacing.
     Its Meta catalog id stays `vino-rosso-200g` (first published that way).
   - **52 Hz. photo:** the bag prints Red Honey · 1,300–1,500 masl. · Red grape, Floral, Wine ·
     Medium Light, which the CSV gives to Vino Rosso. The CSV gives 52 Hz. a medium roast
     *direction* and chocolate–hazelnut notes. The text follows the CSV; the photo needs replacing.
   - **Smooth Black status:** "Current / พัฒนาเป็น SKU หลัก". It stays available, as it already was.
   - **Cold brew Original:** resolved. It is a concentrate; the photo now shows the concentrate
     label, and the page has the owner's copy and a "วิธีชง / How to mix" section (50 mL + 70 mL
     water or milk, 120 mL before ice, about 10 servings per pouch; larger drink 100 + 140 mL).
   - **Mixing ratio:** the Original page uses 50 + 70 mL (owner's copy); the recipe page
     `/cold-brew-recipes/` still uses 50 + 100 mL for its black and milk coffee. Not changed.

1. **Purchase links:** none yet, for any channel or product. LINE SHOPPING was a channel on the
   earlier home page; it isn't in the new list. Add it to `Channel` if it's still used.
2. **Prices and stock:** not shown on the site. The Meta catalog leaves `price` blank and
   says "in stock" because Meta allows nothing else.
3. **Cold brew line-up:** answered by the CSV: Original and Smooth Black are both concentrates;
   Fruity, Orange and Vanilla are planned (unpublished).
4. **Original pouch:** no transparent cutout, only the café photo.
5. **Label points:**
   - Brazil Santos' roast is a direction in the CSV ("medium-dark direction"), shown as such;
   - Brasil vs Brazil, Muranga vs Murang'a, Wash vs Washed.
6. **Origins:** not shown as a separate field. Single origins carry them in the name; blends
   and flavour names have none on the label.
7. **Brewing advice for beans:** none supplied, so none is shown.
8. **Canonical domain:** set to `https://www.balenaroastery.com` in `src/config/site.ts`, the
   page `<head>`s and `public/sitemap.xml`. Change all three if the apex domain is primary.
9. **Recipe page buttons:** `site.links.order` and `site.links.ask` on `/cold-brew-recipes/` are
   unchanged and still empty. Point them at a channel when links exist.

## Checks (`scripts/check-site.mjs`)

These run at 390, 768 and 1440 px:

- **Home:** exact hooks, section order, CTAs and their targets, every product's detail link,
  menu, mobile menu.
- **Catalogue:**
  - cold brew before beans;
  - every product selectable, with tab, name, image and address changing together;
  - no empty rows;
  - each section keeps its own selection;
  - arrow keys, Home/End and the arrow buttons work;
  - back/forward and refresh keep the selection;
  - deep links scroll to the product; unknown slugs fall back;
  - House Blends' second photo shows;
  - image above the panel on phones.
- **About:** the old home text and all four artworks; the language switch works.
- **No basket left:** no basket, checkout, demo or price wording, no forms or inputs, no
  cart links, nothing in `localStorage` but the language.
- **Links:** with no links configured, no dead or `#` links and no purchase buttons; external
  links are safe.
- **General:**
  - every image loads;
  - no horizontal scroll and no console errors;
  - no requests leave the site;
  - pages are indexable with canonical URLs;
  - reduced motion turns off the animations;
  - pages are readable without JavaScript.
- **Redirects:** all old `/trial` addresses and old anchors.
- **Other pages:** recipes, calculator (still `noindex`), sitemap and robots are served.

Purchase buttons were also checked by hand with sample links (not committed): product links
win, store links fill in, `http://` is ignored, and buttons open in a new tab safely.
