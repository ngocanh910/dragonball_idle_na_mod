# Research: Where the Real Hero Art Lives (and how to get it)

Date: 2026-07-03
Related: `plans/260703-fix-game-boot-and-asset-loading/research/research-vvcc-mapping-reality.md`

## The core fact

Real hero art (icons, stand, picture, skill icons, animations) is **NOT in the APK**. It is downloaded
at runtime from an asset CDN and cached on the device. Evidence from the decompiled native code
(`jadx_output`):

- `MainActivity`: the game URL (`window.clientserver` base) is a **base64 string fetched from the config
  server at runtime** (`Base64.decode(gameUrlTs...)`), then passed to `EgretNativeAndroid.initialize(url)`.
  It is **not a static constant in the APK** — which is exactly why we can't read it from the files we have.
- `LaunchActivity`: storage uses `getExternalFilesDir("")` + `ironoriginhoblike = "/game/"`, and downloads
  updates via `HttpURLConnection`. The Egret native engine caches runtime-downloaded resources under the
  app's storage.

## Two possible reasons your live game still shows all art

1. **The device cached it long ago** (while the 2021 servers were alive) — the art sits in the app's
   on-device storage even though the servers are now down.
2. **The asset CDN is still alive** even though the *config* server is dead — your game is still pulling
   art from it right now. (Plausible: nginx asset hosts often outlive game-logic backends.)

Either way, the art is reachable through **your live installation**. Two extraction tracks follow, and a
single network capture tells us which case we're in.

## Track A — Network capture (best outcome: get ALL art)

Intercept the game's HTTPS traffic while it loads hero art, to reveal the live asset CDN base URL + exact
paths. If the CDN is alive, we then bulk-download **every** asset listed in `default.res.json` — not just
what's been viewed.

- Tools: `mitmproxy` (or Charles/Fiddler) as an HTTPS-intercepting proxy; the game device routed through
  it with the proxy CA cert installed.
- Output: the `clientserver` base URL + confirmation the CDN answers 200 for a hero asset.
- Then: a scraper walks `default.res.json`'s URL list against that base and mirrors it into the server's
  resource tree.
- **Risk:** EgretNativeAndroid uses its own native HTTP stack (not the system WebView), so system proxy +
  user CA may be bypassed, and TLS pinning may block interception → may need a **rooted device + Frida**
  to hook the native networking, or a transparent proxy at the router level. This is the main unknown.

## Track B — Device file extraction (works even if CDN is dead)

Copy the already-downloaded art directly out of the device's app storage. Gets only what that device has
cached (art for heroes/screens actually visited), but needs no live server.

- Likely locations (to confirm on-device):
  - External: `/sdcard/Android/data/com.guan.wangys/files/game/…`
  - Internal (needs root): `/data/data/com.guan.wangys/…` (Egret engine resource cache)
- Access methods by device type:
  - **Rooted:** `adb pull` the app data dirs directly.
  - **Non-rooted, Android ≤10:** external files dir is often `adb pull`-able without root.
  - **Non-rooted, Android ≥11:** scoped storage blocks it → use `adb backup` (if `allowBackup=true`) or
    a device-specific export; otherwise root is required.
- Then: verify the cached files' naming (CDN-streamed art uses **plain logical paths**, not VVCC-
  obfuscated names — confirmed earlier: assets absent from `versionConfig` are requested by logical
  path), and copy them into the server resource tree under matching paths.

## Which first?

**Track A recon first** — one capture session answers the decisive question (is the CDN alive + what's its
URL). If yes → Track A bulk-download gets 100% of art (best result). If interception is blocked or the CDN
is dead → fall back to Track B (extract the partial device cache).

## Critical prerequisite (blocks everything)

Physical/ADB access to the device running the game, and knowing its state:
- Is it **rooted**? (decides Track B method and enables Frida for Track A pinning)
- Android version? (decides external-storage accessibility)
- Is `adb` usable on it (USB debugging)?

Without device access, neither track is possible and placeholders (separate plan
`260703-hero-art-rendering`) remain the only option.

## Legal/ethical note
Extracting assets you already have access to (your own device, your own game install) for personal/offline
use of a defunct game is the scope here. Not for redistribution.
