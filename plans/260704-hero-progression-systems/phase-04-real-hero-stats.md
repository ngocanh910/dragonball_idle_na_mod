---
spec_id: phase-04-real-hero-stats
status: pending
acceptance_criteria:
  - "❌ Hero List detail shows each hero's REAL lv200 base stats (not uniform 8000)"
  - "❌ Stats match the Illustration values (e.g. Super Android 17 ATK 91399 / HP 769168 / DEF 11712)"
  - "❌ No client pageerror; battle/power still sane"
---

# Phase 04 — Real hero stats (replace uniform 8000)

## Problem
- Hero List detail shows every hero as ATK/HP/DEF/SPD = 8000, quality 8000 (fake).
- Illustration shows the REAL lv200 base stats (pre-equipment), e.g. Super Android 17:
  ATK 91399, HP 769168, DEF 11712, SPD 415.
- Cause: server sends placeholder attrs (`hero.handler` `getAttrs` + `hero-roster.buildBaseAttr`),
  so the client never runs its own stat formula for owned heroes → defaults to 8000.

## RE findings (verified this session)
- The real stats are NOT stored in any single file — computed client-side by
  **`HeroAttributeCommon.makeHeroBasicAttr(displayId, level, evolveLevel, star)`** and cached in
  `HerosManager._heroBookAttribute_Basic[heroId]`. The Illustration renders that result at level 200.
- `makeHeroBasicAttr` combines (all under `decrypted_assets/game_source/resource/json/`):
  - `heroLevelAttr.json` — base curve per level. **lv200 = {hp:170079, attack:11187, armor:15075}** (360 rows).
  - `heroQualityParam.json` — quality multiplier (keyed by hero.json `quality`, e.g. white…SSS). Main driver of the big SSS numbers.
  - `heroTypeParam.json` — type multiplier (ATK/DEF/SKILL).
  - `heroEvolve.json` (170) — cumulative bonus for evolveLevel ≥ each row's `level` (hp/attack/armor/speed).
  - `heroWakeUp.json` — cumulative bonus for star ≥ each row's `star` (talent/hp/attack/armor/speed).
  - `hero.json` per-hero `balanceHp/balanceAttack/balanceArmor/balancePower` (mostly 1).
  - Red variants: `heroEvolveRed.json`, `heroWakeUpRed.json`, `_heroBookAttributeRed_Basic` (isRed heroes).
- `getHeroBookAttr(ability, model)` then applies talent/percent: for hp/attack `l = base * talent`,
  `hp *= (hpPercent+1)`, etc. — see the `getHeroBookAttr` body.

## Steps
1. Port `makeHeroBasicAttr` + `getHeroBookAttr` to a server util
   (`server/src/services/hero-attr.js`, <200 lines), loading the JSON tables via the game-data service.
2. Compute each owned hero's lv200 base attrs (choose level=200, evolveLevel=max, star=heroBook star or max).
3. Feed the result into `hero.handler` `getAttrs` (the `_attrs`/`_baseAttrs` per hero) AND into
   `hero-roster.buildHerosMap` `_heroBaseAttr`, so the List detail shows real numbers.
4. Validate against the Illustration: pick 2-3 heroes (e.g. Super Android 17) and confirm the List now
   matches the Illustration's ATK/HP/DEF/SPD.

## Verify
- Playwright: open a hero in the List → stats match the Illustration (not 8000). 0 pageerrors.
- Spot-check power/battle still works with real (large) stats.

## Notes
- Prereq synergy: once real attrs flow, some God-Evolve/List visuals may also improve.
- Speed (SPD): confirm where speed base comes from (heroLevelAttr lv200 row lacked `speed`; likely a
  fixed base + wakeup/evolve speed bonuses).
