# Plan: Extract Real Hero Art from Device — 2026-07-03

## Goal
Get the REAL hero art (icons, stand, picture, animations, skill icons) + serve it from this emulator,
sourced from your live game installation — instead of synthetic placeholders.

## Solution
See `research/where-real-art-lives.md`. The art is NOT in the APK; it was CDN-downloaded and cached on
the device. Two tracks: (A) capture the live traffic to find the asset CDN and bulk-download everything;
(B) copy the already-cached art off the device directly. Recon (A) first decides which yields more.

## CRITICAL PREREQUISITE
Access to the device running the game. Needed before any phase — please provide:
- Rooted or not?  ·  Android version?  ·  Is USB debugging / `adb` usable?
The answers pick the method in each phase. Without device access, this plan is blocked (fall back to the
placeholder plan `260703-hero-art-rendering`).

## Phases

### Phase 0 — Device recon & access setup  ·  status: DONE (2026-07-03)
- [x] Device: Xiaomi "garnet", Android 14 / SDK 34, **NOT rooted**; reached via USB adb.
- [x] `run-as` blocked (release build) + no `su`, BUT app external cache is adb-readable thanks to
      `REQUEST_LEGACY_EXTERNAL_STORAGE`: `/sdcard/Android/data/com.guan.wangys/files/game/https/...`.
- [x] Decision: **Track B (device cache extraction) chosen** — cache already holds real art; no proxy needed.
- Detail: `phase-00-device-recon.md`

### Phase 1 — Track A: network capture recon  ·  status: pending
- [ ] Stand up `mitmproxy`; route the device through it + install CA.
- [ ] Launch game, open several heroes → capture asset requests.
- [ ] Extract the live asset CDN base URL; confirm it answers 200 for a hero image.
- [ ] If pinned/native-stack bypass → try Frida (rooted) or transparent router proxy; else go to Phase 3.
- Detail: `phase-01-track-a-network-capture.md`

### Phase 2 — Track A: bulk download all art  ·  status: pending (needs Phase 1 CDN URL)
- [ ] Parse `default.res.json` → full asset URL list.
- [ ] Mirror every asset from the live CDN into `server/.../real-art/` (logical paths).
- [ ] Wire the proxy to serve `real-art/` ahead of placeholders. Verify coverage.
- Detail: `phase-02-track-a-bulk-download.md`

### Phase 3 — Track B: extract on-device cache  ·  status: DONE (2026-07-03)
- [x] Located Egret cache at `.../files/game/https/dragonh5cdn.popoh5.com/bs/resource` (adb-readable).
- [x] Pulled 1007 files / 67 MB via `adb pull` into `real-art/resource/` (git-ignored).
- [x] Naming = plain logical paths (mirror CDN URL) + 206 VVCC-obfuscated blobs. No mapping needed.
- Detail: `phase-03-track-b-device-extraction.md`

### Phase 4 — Integrate & verify  ·  status: DONE (2026-07-03)
- [x] Serving order: real-art (`real-art.routes.js`, before registerAll) → existing pipeline → placeholder.
- [x] Playwright (720×1280, 0 pageerrors): login splash + home render real art; login PNG only-in-real-art
      serves 22,877 B; `zh_cn` hero `_ske.json` → real 13,410 B via locale rewrite.
- [x] Coverage: CDN-only UI art + heroes 1201/1906 newly real; a few uncached overlays still placeholder.
- Detail: `phase-04-integrate-verify.md`

## Success Criteria
- Hero cards / stand / picture / skill icons show the game's REAL art for as many heroes as recoverable.
- The 4 already-bundled heroes still work; nothing regresses.
- Any still-missing art falls back cleanly to placeholders (no blanks, no crashes).

## Risks
- TLS pinning / native HTTP stack blocks proxy interception (Track A) → needs root+Frida or falls to B.
- Asset CDN may be dead → Track A yields nothing → Track B only (partial, device-cache-limited).
- Scoped storage (Android ≥11, non-root) blocks direct file pull → needs adb backup or root.
- Best realistic outcome depends entirely on device access + whether the CDN is still alive.
