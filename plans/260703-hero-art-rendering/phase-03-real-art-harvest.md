---
spec_id: phase-03-real-art-harvest
status: pending
acceptance_criteria:
  - "❌ Any recovered real hero art is served in place of placeholders automatically"
  - "❌ Coverage report: how many of the ~340 heroes now have real art vs placeholder"
---

# Phase 03 — Opportunistic real-art harvest (optional)

## Context
- Independent of Phases 1–2 (placeholders already cover 100%). This only REPLACES placeholders with real
  art wherever it can be found.
- Prior finding (`.../research-vvcc-mapping-reality.md`): the original CDN base is `window.clientserver`
  from a dead config server. Live host `dragonh5cdn.popoh5.com` serves only a Nov-2020 installer APK.

## Overview
Priority: LOW / best-effort. Try to recover genuine hero art from surviving sources and drop it into a
directory the proxy prefers over placeholders.

## Requirements
- Serving order in proxy: real bundled → `harvested-art/` → placeholder. Add `harvested-art/` as a
  higher-priority lookup root in `resource-proxy.routes.js`.
- Harvest attempts (any that pan out):
  - Wayback Machine / CDX API for `popoh5.com` + `sjmobilegame.com` asset paths (hero_icon/stand/picture).
  - Pull the live 2020 APK from `dragonh5cdn.popoh5.com`, unzip, diff its `assets/game` VVCC mapping +
    bundled files against ours — may include a few extra heroes or a fuller mapping.
  - Community/wiki/other-server dumps of this game's hero art (manual, uneven).

## Related code files
- Modify: `server/src/routes/resource-proxy.routes.js` (add harvested-art root ahead of placeholder).
- Create: `tools/harvest-hero-art.js` (Wayback/APK probing script) + `harvested-art/` output dir.

## Implementation steps
1. Add the `harvested-art/` lookup root to the proxy (real-file-wins order).
2. Run harvest probes; deposit any recovered files under the mapped logical paths.
3. Produce a coverage report (real vs placeholder per category).

## Success criteria
See acceptance_criteria frontmatter.

## Risks
- Likely low yield (servers dead, 2020 APK uses same streaming model). Time-box it; placeholders remain
  the guaranteed baseline regardless of harvest results.
