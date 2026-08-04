---
spec_id: phase-00-device-recon
status: pending
acceptance_criteria:
  - "❌ Device root status, Android version, and adb connectivity confirmed"
  - "❌ Reachability of com.guan.wangys app data established (which pull method works)"
  - "❌ Track A vs B feasibility decided"
---

# Phase 00 — Device recon & access setup

## Overview
Everything downstream depends on how we can reach the game device. This phase just establishes the facts
and picks the method. Priority: HIGH (gate for all other phases).

## Steps
1. Install platform-tools on this machine: `adb` available; `adb devices` shows the phone (USB debugging on).
2. Determine root: `adb shell su -c id` (root) vs not.
3. Android version: `adb shell getprop ro.build.version.release`.
4. App presence + storage reachability:
   - `adb shell pm path com.guan.wangys` (installed?)
   - `adb shell ls /sdcard/Android/data/com.guan.wangys/files/` (external, non-root, Android ≤10)
   - `adb shell run-as com.guan.wangys ls files/` (debuggable-app internal access, if allowed)
   - rooted: `adb shell su -c 'ls /data/data/com.guan.wangys/'`
5. Check `allowBackup` in the installed app (our AndroidManifest shows it; confirm on device) → enables
   `adb backup` fallback.

## Decision output
- Rooted → Track B trivial (direct pull) + Track A can use Frida for pinning.
- Non-root + Android ≤10 → external files dir likely pullable (partial Track B) + Track A via proxy.
- Non-root + Android ≥11 → need adb backup or a transparent router proxy; hardest case.

## Risk
- No USB debugging / locked device → blocked; would need an alternate access route (owner enables it).
