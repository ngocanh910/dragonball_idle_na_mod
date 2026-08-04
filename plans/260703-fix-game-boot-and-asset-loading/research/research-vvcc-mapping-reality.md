# Research: VVCC Mapping Reality — Hero Art Is Not In The APK

Date: 2026-07-03
Scope: Verify Phase 1 premise ("RE complete VVCC mapping from APK to recover missing hero images").

## TL;DR — Phase 1 premise is wrong

The missing hero art (hero_stand, hero_picture, hero_icon, hero_still) was **never bundled in the APK**.
There is no VVCC mapping to "recover" because the underlying obfuscated files do not exist on disk.
The APK ships ~2,100 assets; the game references ~11,600 and streams the rest from a CDN at first-run.

## Evidence

### 1. VVCC decryption is COMPLETE, not truncated
- Previous research suspected `vvcc.json` "trailing garbage" meant a partial decrypt.
- Actual trailing bytes = `\x04\x04\x04\x04` → **PKCS#7 padding** (4 bytes of value 4). Clean AES block decrypt.
- `vvcc.json` = 1944 entries, `vvcc_tc.json` = 139 entries. That is the whole mapping. Total 2083.

### 2. The mapping matches disk exactly — nothing to recover
Gap analysis (`assets/game/resource/assets` + `assets_ts`):
| Bucket | on-disk | mapped | unmapped-on-disk | mapped-but-missing |
|--------|---------|--------|------------------|--------------------|
| assets | 2054 | 1944 | 110 | **0** |
| assets_ts | 242 | 139 | 103 | **0** |

- `mapped-but-missing = 0` → every mapped logical path resolves to a real file.
- The 213 "unmapped-on-disk" files are mostly `.bin/.txt/.version/.data` metadata + ~63 generic images — **not** hero art.

### 3. Hero art referenced but absent
`default.res-en.json` (the game's manifest) references:
- hero_stand: 342 entries · hero_picture: 150 · hero_icon (short/long): 595 · hero_still: 171
- Only **16 heroes** have any bundled art on disk (via mapping):
  - Full stand+picture: **1205, 1206, 1207, 1309**
  - DragonBones `_tex` only: **2001–2012**
- All other hero IDs (~340 stands) have **no local file and no mapping**.

### 4. Asset delivery model
- `main.min.js`: `resourceRoot = "resource/assets"` (relative). Manifest URLs carry `?v=<hash>` cache-busters → classic CDN streaming.
- CDN `dragonh5cdn.popoh5.com` is alive (403 root / 404 path = responding) but the only reference found (`downloadAward.json`) is the **APK installer** URL, not the asset root.
- Backend `dragon.sjmobilegame.com` alive (302); `configus.sjmobilegame.com` 403. Asset-root base URL not yet pinned down.
- CDN assets are also obfuscated → fetching them requires the **full/updated vvcc mapping**, which the game downloads at runtime and which we do **not** have locally.

## Options going forward (Phase 1 reframed)

**A. Ship real art only for the 16 bundled heroes.** Lock the mock roster / hero list to {1205,1206,1207,1309,2001–2012}. Zero RE risk, fully offline. Recommended baseline.

**B. Recover assets from the live CDN.** Requires: (1) pin the asset-root base URL (analyze `dragon.sjmobilegame.com` config response + main.min URL builder), (2) obtain the runtime/full vvcc mapping (likely downloaded from CDN as an updated `vvcc.bin`), (3) scrape. High effort, depends on 4-year-old servers still serving 2021 assets. Uncertain.

**C. Substitute art.** Use placeholder/generated Dragon Ball art for unmapped heroes (extends the existing transparent-PNG fallback to something visible). Fully offline, no RE, but not "authentic".

## Option B investigation (2026-07-03) — BLOCKED

Pursued "recover from live CDN". Findings:

1. **Good news: no runtime vvcc needed.** `VersionController.getResUrlByVersion` (main.min.js) only
   obfuscates paths present in `window.versionConfig` (= bundled vvcc, 2083 entries). Paths NOT in it
   are requested at their **plain logical path** (`resource/assets/image/public/hero_related/...`).
   So CDN hero art would be at readable URLs — no deobfuscation required.

2. **Blocker: the CDN base is `window.clientserver`.** Voyage bootstrapper:
   `window.clientserver && (this.resourceRoot = window.clientserver + "/" + this.resourceRoot)`.
   `clientserver` is injected at runtime by the native app from the server config (the `$Cdn` field
   inside encrypted `voyage_fancy_radius.bin`). It is **assigned nowhere in any decompiled JS/smali** —
   its literal value is not in our artifacts.

3. **The config server that supplied it is dead.** All probes 404/000:
   - `dragon.sjmobilegame.com:82` → meta-refresh to `beta/index.html` (404). Known setting paths 404.
   - `configus.sjmobilegame.com` → 403/404. `qsdk.t4game.com` → 200 (SDK only, no assets).
   - `dragonh5cdn.popoh5.com` → alive but serves only the **installer APK**; no H5 bundle / assets at
     any probed root (`/`, `/beta`, `/web`, `/game`, `/DragonBall_en_BS_WEB2V1_202011111431`, ...).
   - Only external host referenced anywhere in code = `dragonh5cdn.popoh5.com` (installer) + `qsdk` (SDK).

**Conclusion:** Option B cannot proceed. The asset CDN base URL is not recoverable from the APK/artifacts
(it was runtime-injected), and the 2021 servers no longer serve the game assets. Recovering real art for
the ~340 unbundled heroes would require either an archived copy of the live CDN (e.g. Wayback/third-party
mirror of the exact host, not yet located) or a device/pcap capture of the original app's config response.

## Recommended fallback
Revert to **Option A** (ship the 16 bundled heroes with real art) as the working baseline, optionally
layered with **Option C** (visible placeholder art) for the rest. Both are fully offline and unblock the
rest of the game (Phase 2/3) which do not depend on hero art.

## Unresolved questions
1. Is there a Wayback/mirror snapshot of the original asset host? (base URL unknown → hard to query)
2. Could a live-device pcap of the original app recover the `clientserver`/`$Cdn` value?
