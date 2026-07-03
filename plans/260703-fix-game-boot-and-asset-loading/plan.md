# Plan: Fix Game Boot & Asset Loading — 2026-07-03

## Status: 🟢 Game boots, logs in, roster locked to 4 real-art heroes, guide disabled, Home ⇄ ChapterMain
## navigation confirmed crash-free and interactive via Playwright (2026-07-03)
## Current Blockers: no real battle simulation (startGeneral is a stub), no real hero list icons

## Phases

### Phase 1: Hero Image Assets — PREMISE CORRECTED 2026-07-03
> Finding: hero art was NEVER in the APK. VVCC decrypt is complete (PKCS#7 padding, not truncated);
> mapping matches disk exactly (0 mapped-but-missing). ~340 hero stands are CDN-streamed, absent locally.
> See `research/research-vvcc-mapping-reality.md`. "RE the mapping" cannot recover files that don't exist.
- Bundled heroes with real art: 1205, 1206, 1207, 1309 (stand+picture) + 2001–2012 (DragonBones tex).
- Chose B) Recover from live CDN → **BLOCKED 2026-07-03**. CDN base = runtime-injected
  `window.clientserver` from a now-dead config server; literal value not in any artifact.
  All live hosts 404 for 2021 assets. See research doc "Option B investigation".
- [x] **Resolved with Option A** — roster locked to `[1205,1206,1207,1309]` (only heroes with real art;
  2001-2012 are battle-only tex, no roster art). New `server/src/services/hero-roster.js` is the single
  source of truth, wired into `enter-game-state.js` + `hero.handler.js`. Art verified serving HTTP 200
  (stand+picture+dragonbones). List icons remain placeholder (no hero has a bundled icon).

### Phase 2: Game Data Completeness
- [ ] Handle more API actions: user/getBulletinBrief, hero/getAttrs with real hero IDs
- [ ] Save hero team changes to server (action: hangup/startGeneral, etc.)
- [ ] Handle item/currency updates (processHandler responses)
- [x] Tutorial/guide flow — **disabled 2026-07-03**. Server sends completed `guide._steps {2:2717,3:3102}`.
  Client patches `TSUIController.prototype.openGuide` → no-op (the single choke point every guide system —
  novice tutorial, weaponCircle, teamDungeon, soulShop, arena — funnels through to build a mask window).
  An earlier attempt patched `GuideInfoManager.startGuide` directly instead; that caused a regression
  (see "Interaction-blocked bug" below) and was replaced.
- [x] **Interaction-blocked bug (reported after guide fix) — root-caused and fixed 2026-07-03.** Not a
  guide regression: the `hangup` request type had zero server handler, so `nextChapter`/`checkBattleResult`
  fell through to an empty `{}` response. The client writes `OnHookSingleton.lastSection = e._curLess`
  unguarded from that response, then rebuilds the Home scene reading `lesson[undefined].exploreTime` →
  uncaught crash → frozen/unresponsive screen. The guide mask had been coincidentally blocking the exact
  click that triggers this path, so the bug was pre-existing but unreached until the guide was disabled.
  Fixed with new `server/src/handlers/hangup.handler.js`. Verified end-to-end with Playwright (installed
  in-project): headless login → Home → Next Chapter → Chapter-1 click reproduced the exact crash before
  the fix and confirmed a clean, fully interactive Home scene after. See
  `research/research-hero-assets-and-crashes.md` header and project-changelog.md 1.2.1 for the full trace.

### Phase 3: Battle Execution
- [x] `hangup/nextChapter` + `hangup/checkBattleResult` minimally handled (see Phase 2 fix above) —
  keeps `OnHookSingleton.lastSection` valid; `checkBattleResult` always reports a synthetic win.
- [ ] Make actual battle start work (`hangup/startGeneral` — currently returns `success({})`, no
  `_rightTeam`/`_rightSuper`/`_battleId`; real battle simulation not implemented)
- [ ] Real battle logic (turn-based combat, not just a synthetic win flag)
- [ ] Post-battle reward flow (currently empty `_changeInfo._items`, no real item grants)

### Phase 4: Polish
- [ ] Real sound (RE MP3 decryption from APK)
- [ ] Proper language-cn_json (currently returns {} — missing translations)
- [ ] Remove placeholder patches once real data is available

## Pending Research Questions
1. Where is the full VVCC mapping in the original APK? (vvcc.json in assets/ may have more entries)
2. How are hero_stand animation frames named? (hero_stand_XXXX.NNNNN pattern)
3. Is vvcc_tc.json the only supplement, or are there more mapping files?

