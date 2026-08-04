---
spec_id: phase-02-tier2-labeled-placeholders
status: pending
blockedBy:
  - phase-01-tier1-static-placeholders
acceptance_criteria:
  - "❌ Each hero's icon/picture shows that hero's NAME + id baked on the rarity frame"
  - "❌ Generated images are cached to disk and reused (no re-render per request)"
  - "❌ No new pageerror; individual heroes visually distinguishable in the collection"
---

# Phase 02 — Tier-2 name-labeled placeholders

## Context
- Builds on Phase 1's classifier + rarity lookup.
- Names: `hero.json` uses a name KEY (e.g. `thingsID_name_*` / localized) → resolve display name via the
  language JSON (`Tips_*` / hero name table). Skill names via `skill.json`.

## Overview
Priority: MEDIUM. Upgrade the static rarity template into a per-hero image with the hero/skill **name and
id** rendered onto it, so cards are individually recognizable rather than just rarity-colored. Generated
lazily and cached to disk; served from cache thereafter.

## Requirements
- Raster lib (pick one): `@napi-rs/canvas` (prebuilt binaries, easy text) or `sharp` (SVG→PNG composite).
  Prefer no system dependency. Bundle a TTF font for deterministic output.
- Resolve display name for a heroId (and skill name for skill icons) from the localized JSON tables.
- Render: rarity-colored frame (Phase-1 template as base) + name + id text, matching the requested
  category's dimensions. Write to a disk cache (`server/.cache/placeholders/<category>_<id>.png`); serve
  the cached file on subsequent requests.

## Related code files
- Modify: `server/src/services/placeholder-art.js` (add labeled render + cache; fall back to Phase-1
  static template if the raster lib or name lookup fails).
- Add dependency in `server/package.json` (or root) for the chosen raster lib.

## Implementation steps
1. Add + smoke-test the raster lib on Node v24 (native build must succeed).
2. Build name resolution (heroId → localized name, skillId → skill name).
3. Implement `renderLabeledPlaceholder(category, id, quality) → cachedFilePath`; integrate into
   `resolvePlaceholder()` ahead of the static template (static remains the fallback).
4. Verify with Playwright: collection shows distinct named cards; cache dir populates; second load
   serves from cache.

## Success criteria
See acceptance_criteria frontmatter.

## Risks
- Native raster lib fails to build on this Node → keep Phase 1 (dependency-free) as the shipping baseline;
  Tier 2 is a pure enhancement and can be skipped without regressing Phase 1.
