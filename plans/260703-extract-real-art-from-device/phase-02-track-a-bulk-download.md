---
spec_id: phase-02-track-a-bulk-download
status: pending
blockedBy:
  - phase-01-track-a-network-capture
acceptance_criteria:
  - "❌ All (or near-all) assets in default.res.json mirrored from the live CDN"
  - "❌ Mirrored art served by the proxy; collection shows real images"
---

# Phase 02 — Track A: bulk download all art

## Overview
With the live CDN base URL from Phase 1, mirror EVERY asset the game references (not just what's been
viewed) into the server. Best-case outcome: 100% real art. Priority: HIGH (if Phase 1 succeeds).

## Steps
1. Parse `decrypted_assets/game_source/resource/default.res-en.json` (+ `default.res.json`) → full list of
   `url` paths (strip `?v=` cache-buster, keep for exact-match retries if needed).
2. Write `tools/mirror-cdn-art.js`: for each url, GET `<cdnBase>/<resourceRoot>/<url>`, save to
   `decrypted_assets/game_source/resource/assets/image/...` at the logical path. Concurrency-limit +
   retry + skip-existing. Log 200 vs 404 per asset.
3. Handle both un-obfuscated (logical) and any versionConfig-mapped paths (most CDN art is logical).
4. Restart server; the existing static mounts + proxy already serve `resource/assets/image/...`, so newly
   mirrored files resolve with no code change (real file wins over placeholder automatically).
5. Coverage report: downloaded vs 404 per category (icon/stand/picture/still/skill).

## Output
- Real art on disk under the normal resource tree.

## Risk
- CDN may 404 for some assets (partial coverage) → those fall back to placeholders.
- Rate-limiting → throttle. Large volume (~9k files) → expect a long run; resumable via skip-existing.
