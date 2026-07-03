---
spec_id: phase-01-tier1-static-placeholders
status: pending
acceptance_criteria:
  - "❌ Every hero card in the 0/132 collection shows a non-blank rarity-colored image"
  - "❌ Hero-detail stand + picture and skill popups show placeholders, not blanks"
  - "❌ The 4 real-art heroes (1205/1206/1207/1309) still show their real art (placeholder never overrides)"
  - "❌ No new pageerror; verified via Playwright"
---

# Phase 01 — Tier-1 static rarity placeholders

## Context
- Solution: `research/solution-hero-art-rendering.md`
- Hook to modify: `server/src/routes/resource-proxy.routes.js`
  - line ~209 — hero_stand frame placeholder (`/hero_stand_\d+\.\d+`)
  - line ~326 — general missing-image placeholder (png/jpg → transparent 1×1)  ← main change
- Rarity source: `decrypted_assets/game_source/resource/json/hero.json` field `quality`
  (7 values: white, green, blue, purple, orange, superOrange, flickerOrange)

## Overview
Priority: HIGH (biggest visual win, zero new deps). Replace the transparent 1×1 PNG returned for missing
hero/skill images with a **meaningful rarity-colored template** selected from the request. Real art and
VVCC-mapped art still resolve first (unchanged); this only changes the final fallthrough.

## Key insight
The proxy already funnels EVERY missing image through two placeholder points. We don't add new routes —
we make those two points smart. Requests arrive in two shapes and both must be classified:
- full path: `/resource/assets/image/public/hero_related/hero_icon_short/hero_icon_1403_short.png`
- Egret RES key: `hero_icon_1403_short_png`, `hero_stand_1925_png`, `hero_picture_1600_jpg`

## Requirements
- Classifier `classifyAsset(reqPath) → { category, heroId } | null` where category ∈
  {icon_short, icon_long, stand, picture, still, skill}. Regexes (tolerant of `_png`/`.png` and full
  paths), e.g. `hero_icon_(\d+)_(short|long)`, `hero_stand_(\d+)`, `hero_picture_(\d+)`,
  `hero_still_(\d+)`; skill-icon naming to be confirmed from `default.res.json` `name` fields.
- Rarity lookup: `heroQuality(heroId)` via game-data `find('hero', heroId).quality`; default `blue`
  when unknown; skill → `skill` generic shape (no rarity).
- Static templates committed under e.g. `server/assets/placeholders/`:
  `icon_<quality>.png`, `stand_<quality>.png`, `picture_<quality>.jpg`, `skill.png`.
  Shapes/sizes should roughly match real assets (icon ~small square, picture ~portrait jpg, stand ~tall).
- Generate the templates ONCE with any available tool (one-off script; ImageMagick/canvas/SVG→PNG in the
  scratchpad) and commit the PNG/JPG outputs — runtime stays dependency-free.

## Related code files
- Modify: `server/src/routes/resource-proxy.routes.js` (both placeholder points + require classifier)
- Create: `server/src/services/placeholder-art.js` (classifier + template path resolver)
- Create: `server/assets/placeholders/*.png|jpg` (committed static templates)

## Implementation steps
1. Confirm skill-icon request naming and heroStand load path (does a static PNG need a sibling
   `_json` atlas? — test one request end-to-end before committing to the stand shape).
2. Write `placeholder-art.js`: `classifyAsset()` + `resolvePlaceholder(reqPath)` returning an absolute
   file path (or null). Cache the parsed hero→quality map.
3. Generate + commit the rarity templates (7 colors × shapes). Keep them small.
4. In `resource-proxy.routes.js`, at both placeholder points: `const ph = resolvePlaceholder(reqPath);
   if (ph) { res.type(...); return res.sendFile(ph); }` — else fall back to the existing transparent 1×1.
5. Restart server; drive Playwright through: collection (0/132) screen, one hero detail (stand+picture),
   a skill popup. Assert images non-blank + zero pageerror + heroes 1205/1206/1207/1309 unchanged.

## Success criteria
See acceptance_criteria frontmatter.

## Risks
- `heroStand` is an animated sprite (`hero_stand_X.png` + `hero_stand_X.json` atlas + numbered frames).
  A single placeholder PNG may not satisfy the atlas path; if so, serve the transparent frame for
  `hero_stand_\d+\.\d+` (keep current behavior) but a colored placeholder for the base `_png`/picture/icon.
  Decide per the step-1 test.
