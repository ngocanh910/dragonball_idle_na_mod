# Project Changelog

All notable changes to this project will be documented in this file.

## [1.2.0] - 2026-07-03

### Fixed (Crash Chain — Game Now Boots to Battle Screen)

#### Resource Loading (Server)
- **JSON fallback:** Added language/path fallback variants (zh_cn → en → public) for `.json` and `.fnt` files.
- **JSON extra path segment:** Added `kaichangdonghua/kaichangzhandouxiangguan/` fallback for DragonBones files.
- **DragonBones version:** Empty `_ske.json` fallback now includes `version: '5.5'` and `compatibleVersion: '5.5'` to prevent `Nonsupport data version` assert.
- **MP3 fallback:** `.mp3` files served from `voyage_extracted/assets_ts/music/` first; if not found, silent MP3 placeholder is returned.
- **Hero stand frames:** Requests matching `/hero_stand_\d+\.\d+` return transparent PNG placeholder.
- **FNT fallback:** `.fnt` files served via language fallback (zh_cn → en).

#### Server API Handlers
- **hero handler:** Added `getAll` action (returns discovered hero list) and `getAttrs` action (returns hero base/total attributes) — required for game flow after enterGame.
- **enter-game-state:** Fixed `_curLess` (0 → 10101 InitialSection), added `lastTeam._lastTeamInfo` for HANGUP type (key `'9'`), added hero 1205 with full `_heroBaseAttr`.

#### Client Patches (browser-boot.js)
- **loadJsonFunc:** Pre-caches critical JSON data (hero, heroWakeUp, skill, constant, etc.) asynchronously before game requests them.
- **HerosManager:** Polls every 100ms to inject default hero if `herosInfo` is empty; wraps `readByData` to re-inject hero after it runs.
- **Sound patch:** Patches `RES.getRes` to return safe stub for `_mp3` keys; no-ops `playSound`, `PlayMusic`, `iphoneClickMusic` on all prototypes; run every 1s.
- **addChild null guard:** Patches `egret.DisplayObjectContainer.prototype.addChild` to silently ignore null children (DragonBones missing data).
- **TSDragonBones.createArmature:** Returns dummy Sprite with mock `.animation.play()` and `.once()` when data missing.
- **clickHeroListItem guard:** Wraps to return early if `HeroList` is empty.
- **setAllHeroList patch:** Injects default hero entry if `HeroList` still empty after `setAllHeroList` runs.
- **imageAnimation guard:** Returns `Promise.resolve()` if input string is undefined (heroStand missing animation base).

### Changed
- **Mock hero:** Changed from 1001 (no wakeup data) → 1201 (has wakeup data) → 1205 (has real decrypted images).
- **All hero data fields** in injectDefaultHero expanded to match `HeroDataModel` expectations (expeditionMaxLevel, heroClass, heroType, heroQuality, qualityStand, qualityBar, heroStand format).
- **config.host / config.publicHost** separated to fix `0.0.0.0` in response URLs.

### Known Issues
- Hero images only available for 1205, 1206, 1207, 1309 (only 4 heroes with decrypted stand/icon files).
- ~580+ obfuscated asset files lack VVCC mapping (hero_icon_long, hero_stand, hero_picture, hero_still).
- Sound is silent (MP3 files encrypted in APK, only 6 bgm/sfx files decrypted).
- Tutorial guide flow still runs (may interfere with navigation).
- Some API handlers return mock/empty data (bulletin, chat, mail).

## [1.1.0] - 2026-07-01
### Added
- Unified client-server architecture overlay in `/client/` directory.
- `client/index.html` as the main entry point to load the Egret engine and client scripts locally.
- `client/browser-boot.js` mock script implementing a browser-compatible JNI native bridge mock. This mock intercepts ExternalInterface calls (`startTsGame`, `changeView`, `enterGame`, `sendLog`, `peiNative`) and automates the engine initialization payload, enabling gameplay debugging in any web browser without an Android device.
- Root `package.json` with npm scripts for startup (`npm start`, `npm run dev`), inspect/debug mode (`npm run debug`), and smoke test execution.
- Automated smoke testing suite in `test/smoke.test.js` verifying static client asset serving, API endpoints, and JNI config payloads.

### Changed
- `server/src/index.js` modified to mount static routes for the `client/` folder, as well as cascading static directories for `/js` and `/resource` mapping directly to the decrypted game assets folders (`voyage_extracted` and `game_source`).
- `server/src/config/index.js` updated to include directory paths for the unified client (`clientDir`), voyage bootstrapper (`voyageDir`), and game source assets (`gameSourceDir`).
