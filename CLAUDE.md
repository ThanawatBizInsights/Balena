# Balena Roastery website: project instructions

Balena Roastery sells **Balena Cold Brew Concentrate Original 500 mL** (stand-up pouch with a
spout). This repo holds two pages. Copy is Thai; the audience is on phones, mostly inside LINE's
in-app browser.

| Route | What | Audience |
|---|---|---|
| `/cold-brew-recipes/` | How to make four drinks with the concentrate, with Remotion animations. Opened from the "วิธีชง Cold Brew" button in the LINE OA rich menu. | Customers |
| `/cost-calculator/` | Cost, yield, hidden costs and profit per pouch. `noindex`, not linked from anywhere. | Owner only |

`/` redirects to `/cold-brew-recipes/`. Read `docs/HANDOFF.md` for history, decisions and open items.

## Stack and commands

React 19 · TypeScript 7 (strict) · Vite 8 (multi-page, `base: "/"`) · Remotion 4.0.534
(`remotion` and `@remotion/player`, pinned to the same exact version) · Noto Sans Thai
(`@fontsource`) · plain CSS · Playwright for checks. Node ≥ 20.19.

```bash
npm install
npm run dev          # http://localhost:5173/cold-brew-recipes/ and /cost-calculator/
npm test             # cost calculation tests (src/cost/calc.test.ts)
npm run build        # typecheck, build to dist/, pre-render the recipe page HTML
npm run serve:dist   # serve dist/ with the vercel.json routing on :4173
npm run check:page   # recipe page in Chromium at 390px and 1366px (needs serve:dist)
npm run check:cost   # cost calculator in Chromium at 390px and 1366px (needs serve:dist)
```

Run `npm test`, `npm run build`, then both checks before every commit. In a cloud container with
Chromium at `/opt/pw-browsers/chromium`, the check scripts use it automatically. Never run
`playwright install` there.

## Where things live

| Path | What |
|---|---|
| `src/config/recipes.ts` | **Recipe quantities, steps, pour order, colours.** Page text, card ratio bars and animations all read from here. |
| `src/config/site.ts` | **Order and contact links, product photo** (path, alt, real pixel size) |
| `src/remotion/` | `RecipeScene` draws any frame (a pure function of the frame number), `RecipeComposition` wraps it for Remotion, `timeline.ts` sets stage timings (30 fps, 14 s) |
| `src/components/` | Recipe page sections; `PlayerPanel` (lazy-loaded player), `RecipeAnimation` (lazy slot, still fallback) |
| `src/entry-server.tsx`, `scripts/prerender.mjs` | Build-time HTML pre-render of the recipe page (readable without JS) |
| `src/cost/calc.ts` | Cost maths (pure). `calc.test.ts` checks it against hand-worked numbers. |
| `src/cost/defaults.ts` | **Calculator starting values.** Owner's real figures are `source: "yours"`; the rest are `"estimate"`. |
| `src/cost/CostApp.tsx`, `cost.css` | Calculator UI |
| `cold-brew-recipes/index.html`, `cost-calculator/index.html` | Page entries |
| `vercel.json` | Build settings and routing for Vercel (overrides the dashboard preset) |
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
- **Brand palette:** cream `#FBF5EA`, ocean blue `#145A8C`, coffee brown `#5B3A24`, light
  blue `#D6EAF6`, ink `#22303A`. Tokens live in `src/styles.css`. Keep it clean and warm, with
  little decoration and little motion.
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
- **Git:** work on a branch and open a pull request; leave `main` for reviewed work.
- **Separate project:** this repo has nothing to do with the CheckKhum project. Never copy
  code, links or settings between them.
