# Balena Operations: showcase video

Two cuts of a product video for the Balena Roastery operations system, built with Remotion
(4.0.534, the same version as the recipe page).

| Composition | Size | Length | Output |
|---|---|---|---|
| `Main` | 1920 × 1080 (16:9) | 60 s | `out/balena-ops-showcase-16x9.mp4` |
| `Social` | 1080 × 1920 (9:16) | 30 s | `out/balena-ops-showcase-9x16.mp4` |

Thai captions, short English feature labels, no voiceover. Music and interface sounds are
synthesised by `scripts/make-audio.py` (original, no samples, licence-free).

## Data and privacy

Every interface scene is the real app (`/ops/`, built site) captured with **demo data**
(`scripts/demo-data.mjs`): fictional quantities, amounts, dates and a "Demo" user. Only the public
product, category, channel and branch names are real. The capture script answers the app's
database requests itself; it never connects to Supabase, so production records are untouched.
Every interface scene carries the "ข้อมูลตัวอย่าง / Demo data" badge. No customer data, emails,
phone numbers, addresses, account balances (shown as "no data"), credentials, internal URLs or
sign-in screens appear.

## Rebuild

```bash
npm install
# 1. Interface scenes (needs the site built and served: in the repo root `npm run build && npm run serve:dist`)
npm run capture            # → public/shots/*.png + boxes.json (element positions for zooms/cursor)
# 2. Audio
npm run audio              # → public/audio/*.wav (not committed; run before studio or render)
# 3. Preview / edit
npm run studio
# 4. Render (cloud container: Chromium at /opt/pw-browsers/chromium, new headless mode)
npm run render:main
npm run render:social
node scripts/stills.mjs Main 300 900   # inspection stills → out/stills/
```

## Where things are

| Path | What |
|---|---|
| `src/brand.tsx` | Colours, fonts (Kanit, Noto Sans Thai, Archivo Black), camera over screenshots, highlight, cursor, browser/phone frames, captions, demo badge, whale and wordmark, counters |
| `src/parts.tsx` | Outline icons, problem cards, feature tags, 4-day lead-time chip, provisional → final card, sound cues |
| `src/Main.tsx`, `src/Social.tsx` | The two cuts, scene by scene (timings in frames at 30 fps) |
| `scripts/demo-data.mjs`, `scripts/capture.mjs` | Demo dataset and capture of the real app |
| `scripts/make-audio.py` | Music bed and interface sounds |

## Feature checklist (checked in the code on 1 Nov 2026)

**Working (shown as working)**
- Sign-in, roles, owner-only actions, approvals, audit history (not shown on screen)
- Records: sales, expenses, purchases, transfers, counts, adjustments, payments, opening balances
- Overview dashboard: sales, cash received, expenses, profit only when costs are known
  ("รอต้นทุนครบ / Costs pending" otherwise), sales by channel, sales to settlement, needs attention
- Stock by branch with category filter, negative-stock warnings, movement history
- Output-first production: record the finished product, add materials later, then complete the batch
- ICONSIAM workspace: total sales (multi-month, provisional toggle, top products, product table, CSV),
  current sales & stock, replenishment status, 4-day preparation lead time (default, adjustable),
  preparation timeline, deliveries (plan → dispatch → receipt), printable delivery notes
- Sales layer: interim updates replaced by the official report (never added together), revisions

**Partially implemented (shown with their real state)**
- Profit: needs product costs; the demo shows "Costs pending", as the app does
- Online channel fees: not settled yet (shown as unknown in the app)
- Opening balances: not agreed yet (the app's own banner says so)
- ICONSIAM code mappings: waiting for owner review

**Not built (not shown, not claimed)**
- Customer management (CRM records, customer profiles, marketing): none in the app
- Live integrations with Shopee, Lazada, LINE or ICONSIAM systems: reports are imported, not synced
- Automated or AI forecasts: replenishment is a rule-based calculation from recorded sales
- Business-growth, time-saving or customer-count figures
