---
spec_id: phase-01-track-a-network-capture
status: pending
blockedBy:
  - phase-00-device-recon
acceptance_criteria:
  - "❌ The live asset CDN base URL (what window.clientserver resolves to) is captured"
  - "❌ Confirmed the CDN returns 200 for at least one real hero image"
---

# Phase 01 — Track A: network capture recon

## Overview
Intercept the game's HTTPS traffic while it loads hero art to reveal the live asset CDN base URL + path
shape. This single capture decides whether Track A (bulk download everything) is possible. Priority: HIGH.

## Steps
1. Start `mitmproxy`/`mitmweb` on this machine (note LAN IP + port 8080).
2. Point the device at it: Wi-Fi proxy = machine IP:8080; install mitmproxy CA cert on the device
   (`http://mitm.it`). For Android ≥7 user certs are distrusted by apps → may need system cert (root) or
   the app may still ignore it (native stack).
3. Launch the game; navigate: open the Hero collection, several hero details, skill popups, a battle —
   forcing art downloads.
4. In mitmproxy, filter for image requests (`.png/.jpg`, `hero_icon/hero_stand/hero_picture/skill`).
   Record the **host + base path** = the `clientserver` base.
5. Sanity-check liveness: `curl -I <cdnBase>/resource/assets/image/public/hero_related/hero_picture/hero_picture_1600.jpg`.

## If interception shows nothing (pinning / native HTTP bypass)
- Rooted: use **Frida** to hook the native networking / dump the URL the engine requests
  (`EgretNativeAndroid` / libegret). Or install mitm CA into the system store.
- Or transparent proxy at the router (redirect :443 through mitmproxy) — catches native-stack traffic.
- If still nothing and no root → Track A blocked → proceed to Phase 3 (Track B extraction).

## Output
- `cdnBase` URL + a confirmed-working sample asset URL → feeds Phase 2.

## Risk
- TLS pinning is the main blocker; mitigations above. Time-box; fall back to Track B.
