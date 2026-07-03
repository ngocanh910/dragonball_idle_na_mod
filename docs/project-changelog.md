# Project Changelog

All notable changes to this project will be documented in this file.

## [1.2.1] - 2026-07-03

### Investigated (Hero Art / VVCC Mapping)
- **Finding:** Missing hero art was never bundled in the APK. VVCC decryption is complete (PKCS#7
  padding, not truncated); the 2083-entry mapping matches disk exactly (0 mapped-but-missing).
  ~340 hero stands / 150 pictures / 595 icons referenced by `default.res.json` are CDN-streamed and
  absent locally. See `plans/260703-fix-game-boot-and-asset-loading/research/research-vvcc-mapping-reality.md`.
- **CDN recovery (Option B) blocked:** Asset base URL is runtime-injected `window.clientserver` from a
  now-dead config server; literal value not present in any artifact. All 2021 hosts 404 for game assets.

### Changed (Hero Roster Locked to Renderable Set)
- **New `server/src/services/hero-roster.js`:** single source of truth for the renderable roster
  `[1205, 1206, 1207, 1309]` — the only heroes with real bundled art (hero_stand + hero_picture +
  DragonBones ske/tex, all verified serving HTTP 200).
- **`enter-game-state.js`:** `heros._heros` and `lastTeam` hangup team now built from the roster module
  (4 heroes pre-placed in formation) instead of a single hardcoded hero.
- **`hero.handler.js`:** `list`/`getList` and `getAll` now return the locked roster instead of the first
  20 arbitrary heroes / hardcoded 1205.

### Changed (Guide System Disabled)
- **All guide systems removed** (novice tutorial 新手引导, weaponCircle, teamDungeon, soulShop, arena,
  appraisal, ...). `enter-game-state.js` sends a completed `guide` state (`_steps: {2: 2717, 3: 3102}` —
  MAIN/TASK lines at MainGuideEndID/TaskGuideEndID) so the novice tutorial's own step logic reports
  finished. `browser-boot.js` patches `TSUIController.prototype.openGuide` to a no-op — every guide
  system (`GuideInfoManager.startGuide()` and the various `triggerXxxGuide()`/`triggerGuideByType()`
  helpers) funnels through this single choke point to build a `TSGuideWindow` mask, so neutering it here
  blocks all of them without needing to mark every guide line's completion step individually.
- **Regression + fix (same day):** an earlier version of this change forced `GuideInfoManager.startGuide()`
  itself to always return `true`. That made `Home.initAll()`'s `0!=startGuide()` check always pass, which
  unblocked ITS OWN follow-up block probing other guide lines (weaponCircle/teamDungeon/soulShop) that
  were not marked complete — those fired `openGuide()` and left an untouchable full-screen mask (game
  became completely unresponsive to clicks). Fixed by patching `openGuide` directly instead of forcing
  `startGuide`'s return value.

### Fixed
- **`checkHasLinkOnBattle` crash (`Cannot read properties of undefined (reading 'indexOf')`):** surfaced
  after locking the 4-hero roster (4 heroes now sit in the hangup team, so the battle-list refresh reaches
  the hero-link check). The client's `injectDefaultHero` (browser-boot.js) built a plain hero object into
  `herosInfo` without `linkTo`/`linkFrom`; the game reads `hero.linkTo.indexOf(...)` and `hero.linkFrom`
  unguarded. Added `linkTo: []` and `linkFrom: ''` to match `HeroDataModel` defaults.

### Fixed (Root Cause: "Cannot Interact With Anything" — Verified with Playwright)
- **`hangup` request type had NO server handler at all.** Every `hangup/*` action (nextChapter,
  checkBattleResult, gain, ...) silently fell through to `fallback.handle()` → `success({})`. Two of
  these are read unguarded by the client and directly corrupt `OnHookSingleton` state:
  - `nextChapter`'s callback does `OnHookSingleton.getInstance().lastSection = e._curLess` unconditionally,
    then immediately rebuilds the Home scene. With `e._curLess` undefined (empty `{}` response),
    `lastSection` becomes `undefined`, and the next `Home.initData()` does
    `ReadJsonSingleton.getInstance().lesson[undefined].exploreTime` → `TypeError: Cannot read properties
    of undefined (reading 'exploreTime')` — an uncaught client-side crash that halts input entirely
    (looks exactly like "the whole game froze / can't click anything", not a visible error dialog).
  - `checkBattleResult`'s win branch does the same `lastSection` write, plus `getBattleAwardItems(t)`
    reads `t._changeInfo._items` unguarded.
  - This was masked before the guide fix: the guide mask sat on top of `ChapterMain`, blocking the exact
    click that triggers `hangup/nextChapter`, so the crash was never reached. Disabling the guide exposed
    this pre-existing gap — it was not introduced by the guide changes, only unmasked by them.
- **Fix:** new `server/src/handlers/hangup.handler.js`, registered in `handlers/index.js`. Returns a
  valid `_curLess: 10101` (InitialSection, a real `lesson.json` key) for `nextChapter`; a synthetic win
  (`_battleResult: 0`) with valid `_curLess`/`_maxPassLesson`/`_maxPassChapter`/`_changeInfo` for
  `checkBattleResult`; and a guarded `_changeInfo` for `gain`. Other hangup actions
  (startGeneral/getChapterReward/getLessonFundReward/buyLessonFund/saveGuideTeam) have no unguarded
  reads found in the client and return `success({})` — real battle logic remains Phase 3 scope.
- **Verification method:** installed Playwright + Chromium in the project, drove the full flow headlessly
  (login → server select → Home → Next Chapter → Chapter-1 node) with console/pageerror capture and
  screenshots. Before the fix: reproduced the exact `TypeError: Cannot read properties of undefined
  (reading 'exploreTime')` at `Home.initData` and a permanently blank/frozen screen. After the fix: no
  console errors, scene rebuilds into a fully rendered, interactive Home screen ("New adventure begins!").

### Fixed (Hero List Crash — Verified with Playwright)
- **`CheckHeroInExpeditionMachine` crash (`Cannot read properties of undefined (reading 'machines')`)**
  on opening the Hero List screen. `UserDataParser.saveUserData` only calls
  `ExpeditionManager.setExpeditionModel(e.expedition)` when `e.expedition` is truthy; our enterGame state
  had no `expedition` field at all, so `_expeditionModel` was never set, and the Hero List's red-dot
  check (`checkHeroHasRedPoint` → `CheckHeroInExpeditionMachine`) reads `.machines` off it unguarded.
  **Fix:** added `expedition: {}` to `enter-game-state.js`. `ExpeditionModel`'s constructor already
  defaults `machines`/`passLesson`/`teams` to `{}` and `collection` to `[]`, and `deserialize({})` is a
  no-op, so an empty object is sufficient — no other expedition feature data needed.
- **Verified with Playwright:** login → Home → click Hero button. Before the fix: reproduced the exact
  `reading 'machines'` crash. After: Hero List renders cleanly showing all 4 roster heroes (S/A/B/B rank
  cards), no console errors.

### Changed (Player Level Raised to 200)
- Player level is stored as an item count (`PLAYERLEVELID`=104), read everywhere via
  `ItemsCommonSingleton.getItemNum(104)` — not a dedicated `user.level` field. `enter-game-state.js`
  `totalProps._items` was empty, so level defaulted to 0 and every level-gated feature stayed locked.
  Set to `{_id: 104, _num: 200}` + exp (`_id: 103`) at the level-200 threshold (`userUpgrade.json
  expNeeded: 4659000`) so level/exp stay internally consistent. Verified via Playwright:
  `UserInfoSingleton.getUserLevel()` → `200`.
- **Follow-on crash found + fixed:** raising the level unlocked the level-gated Entrust feature
  (`OpenLimit.checkEntrustLimit()`), which called `type:"entrust" action:"getInfo"` — another handler
  that had never existed, falling through to an empty `{}` response. `EntrustSingleton.initData(t._model)`
  reads `e._entrusts._entrusts` unguarded → `TypeError: reading '_entrusts'`. Same class of bug as the
  `hangup` gap: added `server/src/handlers/entrust.handler.js` returning a valid empty
  `_model: {_entrusts:{_entrusts:{}}, _helpedFrieds:[], _refreshCount:0, _helpFriendHero:''}`.
- **Pattern note for future level-gated features:** raising level surfaces previously-unreachable
  `type:"<feature>"` requests one at a time as each unlocks. Expect more of these (same fix shape:
  empty/minimal object matching the field the client reads unguarded) as higher-level features are
  exercised — check server console for `[Fallback] No handler for type=...` after any new crash report.

### Known Issues
- No hero has a bundled list icon (`hero_icon`: 0 mapped for all heroes) — list thumbnails still use the
  transparent-PNG placeholder.
- `hangup/checkBattleResult` always reports a win with fixed lesson/chapter ids — no real battle
  simulation or progression tracking yet (Phase 3).
- Expedition feature itself (machines/collection/teams) is not implemented — only stubbed enough to
  avoid the crash. Opening the actual Expedition screen may still be missing data.
- Entrust feature itself (friend entrust list/rewards) is not implemented — only stubbed enough to avoid
  the crash. Opening the actual Entrust screen may still be missing data.
- Other level-200-gated features (arena, guild activities, etc.) have not been exercised yet and may
  have similar missing-handler crashes waiting to surface.

### Fixed (Currency Display Crash — Verified with Playwright)
- **`getPriceInfoWithCurrency` crash (`Cannot read properties of undefined (reading 'en')`)**, firing on
  every render frame for any priced-item UI (repeats via `requestAnimationFrame`, effectively freezing
  that screen). `ts.currency = e.currency` (from `saveUserData`), then used as a **lookup key** into
  `currencyDisplay.json[ts.currency][language]`. `enter-game-state.js` had `currency: {}` — an empty
  object is truthy (so the function's `!ts.currency` guard didn't trigger) but isn't a valid
  `currencyDisplay.json` key (`"USD"`, `"CNY"`, `"KRW"`, `"VND"`, ...), so the lookup returned `undefined`
  and reading the language field off it crashed.
- **Fix:** changed `currency: {}` → `currency: 'USD'` in `enter-game-state.js`.
- **Verified with Playwright:** login → Home → Hero → Top-up (currency-priced shop button) produced zero
  `pageerror` events; `getUserLevel()` stayed 200 throughout.

### Added (Free Top-Up / Instant Gem Purchase)
- **No real payment gateway exists in this local emulator** (no Google Play Billing, no receipt
  verification), so top-up previously did nothing when clicked — `recharge()` sent
  `type:"recharge",action:"recharge"` to the server, got an empty `{}` fallback response, and the client
  just logged "预支付失败" (prepay failed) silently.
- **Root cause / real flow traced:** `recharge()` → server returns `prePayRet` → if `errorCode===0`,
  client calls `ts.payToSdk(prePayRet.data)` → `window.paySdk(data)` (a native Android JS-bridge object
  in the real APK, never defined in a browser). The actual reward-granting step is normally a
  server-pushed `Notify` socket event (`action:"payFinish"`) sent only after the backend verifies payment
  with Google Play out-of-band — a round trip with no local equivalent.
- **Fix (two parts):**
  1. New `server/src/handlers/recharge.handler.js` — looks up the real `recharge.json` package (base
     diamond + first-purchase bonus, matching the "First x3" badges already shown in the UI) by
     `goodsId` and returns it in `prePayRet.data`.
  2. `client/browser-boot.js` now defines `window.paySdk` to grant the purchase **immediately**, by
     calling `ts.notifyData({action:'payFinish', _code:0, _detail:{...}})` itself — the same call path a
     real payFinish push would trigger — instead of waiting on a payment provider that doesn't exist here.
- **Two non-obvious payload gotchas found by tracing `TSUIController.openCommonItemGetTips`** (the
  function `payFinish` ultimately calls, which does the real persistence via
  `ItemsCommonSingleton.setItem`):
  1. `_changeInfo._items` must be keyed **by the item id itself** (e.g. `{101: {...}}` for
     DIAMONDID=101), not index-keyed with an `_id` field inside (that's `setBackpack`'s convention for
     `totalProps._items`, a different code path — `openCommonItemGetTips` reads `Number(f)`, the object
     key, not `.{_id}`).
  2. `_num` must be the **new absolute total**, not the purchased delta — the function derives the
     displayed "+N" popup amount itself via `_num - getItemNum(id)`. Sending the raw delta silently
     overwrote the balance instead of adding to it.
- **Verified with Playwright:** bought the $0.99/60-Gems package → diamond balance 0→180 (60+120
  first-purchase bonus) with the correct "You Get 180" reward popup rendering; bought the $4.99/300-Gems
  package next → balance 180→1080 (+900 = 300+600 bonus), confirming cumulative addition works correctly
  across repeated purchases. Zero `pageerror` events in either purchase.

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
