---
spec_id: phase-03-track-b-device-extraction
status: pending
blockedBy:
  - phase-00-device-recon
acceptance_criteria:
  - "❌ The on-device Egret resource cache located and pulled off the device"
  - "❌ Cached art naming verified and copied into the server resource tree"
---

# Phase 03 — Track B: extract on-device cache

## Overview
Fallback (and works even if the CDN is dead): copy the already-downloaded art out of the app's storage.
Gets only what that device cached, but needs no live server. Priority: MEDIUM (run if Track A blocked, or
in parallel for coverage the CDN might miss).

## Steps
1. Locate the resource cache (from Phase 0 access):
   - `adb shell ls -R /sdcard/Android/data/com.guan.wangys/files/` (external)
   - rooted: `adb shell su -c 'ls -R /data/data/com.guan.wangys/files'` — look for a `resource/`,
     `assets/image/`, or engine cache dir with hero_icon/hero_stand/hero_picture files.
2. Pull it: `adb pull <path> ./device-dump/` (root or Android ≤10); else `adb backup -f game.ab
   com.guan.wangys` then unpack (`abe`/`android-backup-extractor`).
3. Inspect naming: CDN-streamed art should be **plain logical** (`hero_icon_1403_short.png`), not VVCC-
   obfuscated. Confirm; if obfuscated/encrypted, reuse existing VVCC + decrypt tooling.
4. Copy recovered files into `decrypted_assets/game_source/resource/assets/image/...` at logical paths
   (same tree Track A targets), so serving needs no code change.
5. Coverage report of what this device had cached.

## Risk
- Partial coverage (only viewed heroes cached). Combine with Track A where possible.
- Android ≥11 scoped storage without root → needs adb backup path; if `allowBackup=false` on device,
  blocked without root.
