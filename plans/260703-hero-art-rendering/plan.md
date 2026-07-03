# Plan: Hero Art Rendering — 2026-07-03

## Goal
Make hero icons / stand / picture / skill icons render for ALL heroes (not just the 4 with bundled art),
via a layered placeholder system in the resource proxy. Real art always wins; placeholders fill gaps.

## Solution
See `research/solution-hero-art-rendering.md`. Core: upgrade the proxy's "missing image → transparent 1×1
PNG" fallthrough into a meaningful, rarity-colored (Tier 1) then name-labeled (Tier 2) placeholder
responder, keyed off hero/skill id + category parsed from the request URL.

## Serving order (first hit wins)
real bundled art (4 heroes) → harvested real art (optional, Phase 3) → placeholder (Phase 1/2)

## Phases

### Phase 1 — Tier-1 static rarity placeholders  ·  status: pending
- [ ] Build a request classifier: parse `{category, id}` from asset URLs
      (hero_icon_short/long, heroStand, hero_picture, hero_still, skill icons).
- [ ] Look up rarity color from `hero.json.quality` (skill → generic).
- [ ] Pre-render static templates: (7 rarity colors) × (icon, stand, picture, skill shapes), commit them.
- [ ] Wire into `resource-proxy.routes.js` missing-image hook: serve matching template instead of the
      transparent 1×1. Keep transparent fallback only for truly unclassifiable requests.
- [ ] Verify with Playwright: collection + hero-detail show rarity-colored art, no 404/pageerror.
- Detail: `phase-01-tier1-static-placeholders.md`

### Phase 2 — Tier-2 name-labeled placeholders  ·  status: pending
- [ ] Add a raster lib (`@napi-rs/canvas` or `sharp`) + bundled TTF font.
- [ ] Generate placeholder with hero/skill name + id baked onto the rarity frame; cache to disk on first
      request; serve cached thereafter.
- [ ] Verify individual heroes are visually distinguishable.
- Detail: `phase-02-tier2-labeled-placeholders.md`

### Phase 3 — Opportunistic real-art harvest (optional)  ·  status: pending
- [ ] Probe Wayback Machine for the popoh5 CDN asset tree; pull the live 2020 APK and diff its assets.
- [ ] Drop any recovered real files into a `harvested-art/` dir the proxy prefers over placeholders.
- Detail: `phase-03-real-art-harvest.md`

## Success Criteria
- Every hero card in the collection (0/132 screen) shows a non-blank, rarity-appropriate image.
- Hero detail (stand/picture) and skill popups show placeholders instead of blanks.
- Zero new `pageerror`s; the 4 real-art heroes still show their real art (placeholders never override).

## Risks
- `heroStand` may need a `.json` atlas alongside the PNG for Egret RES (verify in Phase 1).
- Tier-2 raster lib native-build issues on this Node (v24) — mitigated by Tier 1 needing no lib at all.
