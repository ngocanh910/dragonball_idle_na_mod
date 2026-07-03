# Solution: Hero Art Rendering (icons / stand / picture / skill icons)

Date: 2026-07-03
Related: `plans/260703-fix-game-boot-and-asset-loading/research/research-vvcc-mapping-reality.md`

## Problem

Hero list / collection / detail screens show **text data** correctly (name, skills, ATK/HP/DEF/SPD,
rarity stars) — because all of that comes from JSON files we have (`hero.json`, `skill.json`, ...).
But **no images render**: hero icons (card thumbnails), hero stand (animated sprite), hero picture
(full art), and skill icons are all blank.

## Root Cause (already established, re-verified 2026-07-03)

The art was **never bundled in the APK**. Disk inventory today:

| Category | Referenced by `default.res.json` | On disk |
|----------|----------------------------------|---------|
| hero_icon_short / _long | ~595 | **0** |
| heroStand (sprite) | 342 | 6 files → only heroes **1205, 1206, 1207, 1309** (+2 guide idles) |
| hero_picture (jpg) | 150 | **0** |
| hero_still | 171 | **0** |
| skill icons (`*_skill*`) | 243 | **0** (only 96 DragonBones skill *effect* animations, not icons) |

The missing art was streamed at runtime from a CDN whose base URL is the runtime-injected global
`window.clientserver` (from a now-dead config server). All 2021 hosts 404; the only live host
(`dragonh5cdn.popoh5.com`) serves an **older Nov-2020 installer APK**, not the H5 asset tree.
**Conclusion: real art cannot be reliably recovered.** We must synthesize it.

## Current handling

`server/src/routes/resource-proxy.routes.js` already catches every missing-image request and returns a
**1×1 transparent PNG** (line ~326-337). That is exactly why cards are "blank" rather than broken/404.
This single fallthrough point is where the fix goes.

## Options considered

**A. Procedural placeholder art (server-side).** Replace the transparent 1×1 with a *meaningful*
placeholder chosen from the request: parse the hero/skill id + art category out of the URL, look up the
hero's rarity color (`hero.json.quality`, 7 values: white/green/blue/purple/orange/superOrange/
flickerOrange) or skill info, and serve a rarity-colored frame — optionally with the hero/skill **name**
baked in. Fully offline, deterministic, covers 100% of heroes/skills. **← recommended core.**

**B. Harvest real art externally** (Wayback Machine snapshots of the popoh5 CDN, the live 2020 APK,
community/wiki mirrors, other server dumps). Uncertain yield, uneven coverage, some legal grey. Best used
as an **opportunistic layer on top of A**: any real file found is dropped into an art dir the proxy
prefers; placeholders fill the rest. Not a standalone solution.

**C. Reuse the 4 real stands as stand-ins for everyone.** Cheap but every hero looks identical (all
Goku-1205). Rejected except possibly as the base image for the "stand" placeholder shape.

## Recommended solution — layered placeholder system

Serving order in the proxy (first hit wins): **real bundled art → harvested real art → placeholder**.
The first two already work; we add the third and make it meaningful.

Two fidelity tiers for the placeholder itself:

- **Tier 1 — static rarity templates (no new dependency).** Pre-render one placeholder per
  (rarity-color × art-shape) — e.g. `icon_blue.png`, `stand_orange.png`, `picture_purple.jpg`,
  `skill_generic.png` — commit them to the repo, and have the proxy pick by the hero's quality. Instantly
  turns blank-blue cards into correctly rarity-colored cards. Biggest visual win for least effort/risk.

- **Tier 2 — labeled placeholders (adds a raster lib).** Runtime-generate a placeholder with the hero/
  skill **name** and id text baked onto the rarity frame, cached to disk on first request. Needs a
  rasteriser: `@napi-rs/canvas` or `sharp` (npm, no system dep) preferred over system ImageMagick
  (not currently installed). Makes every card individually recognizable.

## Why this is the right call

- The only 100%-reliable path (real art is gone). Deterministic, offline, no dead-server dependency.
- Reuses the exact fallthrough hook already in the proxy — minimal, localized change.
- Layered: real art (4 heroes today, more if harvested later) always wins; placeholders only fill gaps.
- Incremental: Tier 1 ships value immediately with zero new dependencies; Tier 2 and harvesting are
  independent follow-ups.

## Open questions

1. Tier-2 rasteriser choice: `@napi-rs/canvas` (prebuilt, easy text) vs `sharp` (SVG→PNG compositing).
2. Does the animated `heroStand` need a matching `.json` atlas for a static placeholder PNG to load, or
   does the client tolerate a plain texture? (verify against Egret RES / imageAnimation path).
3. Fonts for Tier-2 text rendering (bundle a TTF to keep output deterministic across machines).
