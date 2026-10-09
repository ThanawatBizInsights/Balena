# Balena Cold Brew: วิธีชง (`/cold-brew-recipes`)

A mobile-first Thai recipe page for **Balena Cold Brew Concentrate Original 500 mL**. Customers
open it from the "วิธีชง Cold Brew" button in the LINE OA rich menu. It has four starter recipes,
each with a 14-second Remotion animation, plus strength and storage advice.

It is a static site built with React 19, TypeScript, Vite and Remotion Player.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173/cold-brew-recipes/
npm run build        # typecheck + production build into dist/
npm run preview      # serves dist/ at http://localhost:4173/cold-brew-recipes/
```

Page check (Chromium at 390px and 1366px: Thai text, quantities, layout, buttons, player,
animation length, reduced motion). Writes screenshots to `screenshots/`:

```bash
npm run build && npx vite preview --port 4173 &
npm run check:page
```

Animation contact sheet, for reviewing every recipe after an edit (dev server only):
`http://localhost:5173/cold-brew-recipes/dev/frames.html`

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
2. **`links.order`**, the URL for "สั่งซื้อ Balena Cold Brew".
3. **`links.ask`**, the URL for "สอบถามวิธีชง" (probably the LINE OA chat link).

Until 2 and 3 are set, both buttons render disabled. In `npm run dev`, a yellow bar at the top
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
- **Route.** `vite.config.ts` sets `base: "/cold-brew-recipes/"`, so `dist/` must be served at
  that path.

## Hosting

`dist/` is plain static files, so any static host works (Vercel, Netlify, Cloudflare Pages, an
existing web server). Point the LINE rich menu button at `https://<your-domain>/cold-brew-recipes/`.

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
