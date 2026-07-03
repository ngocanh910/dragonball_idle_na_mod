# Plan: Hero Progression Systems (God Evolve · Affinity/Resonance · Super Combos) — 2026-07-04

## Goal
Light up the three hero progression systems that stay inactive even though all 132 heroes are owned:
1. **Affinity / Resonance links** (羁绊) — hero-link bonus effects (user's top priority).
2. **God Evolve stars** (神觉醒) — the Illustration/God-Evolve cards stay grayscale with empty stars.
3. **Super Ultimate combos** — the combo skill list is empty/locked.

## Context (what already works — do NOT redo)
- All 132 heroes OWNED: `enter-game-state.js` → `heroRoster.buildHerosMap()`. `getHeroList()` = 132. ✓
- Codex "collected" recognition FIXED (v1.2.8): routed socket `heroImage/getAll → hero.handler`, so
  `HerosManager.getAlreadyGainHeroID()` = 132 and the codex counter shows **132/159**. ✓
- English + full v110 art on disk (`real-art/`, ~600MB). ✓

## Key facts / methodology
- Game JS (no IIFE, everything on `window`): `decrypted_assets/game_source/js/main.min_7eae4d6e.js`.
- Server enter-game payload builder: `server/src/services/enter-game-state.js`.
- Socket request routing: `server/src/handlers/index.js` (`HANDLERS[type]`), fallback returns `{}`.
- **Probe technique** (fastest): Playwright headless (viewport 720×1280), login flow
  username(345,828)→pass(345,949)→PLAY(345,1075)→server(197,587)→PLAY(345,1075); then
  `page.evaluate(() => window.HerosManager.getInstance()…)`. Server: `node server/src/index.js`
  (kill ALL :8080 node first — no hot-reload; use managed background task).
- Data configs: `decrypted_assets/game_source/resource/json/{heroConnect,heroConnectLevelMax,
  heroConnectSeatBuyTime,superBook,superEvolve,heroBook,heroEvolve}.json`.

## Phases (priority order = user's)
### Phase 1 — Affinity / Resonance links  ·  status: pending  ·  detail: phase-01-affinity-resonance.md
Populate `enter-game e.resonance` so `setResonanceModel` fills `resonanceData.cabins` and links activate.

### Phase 2 — God Evolve stars  ·  status: pending  ·  detail: phase-02-god-evolve-stars.md
Find + populate the per-hero god-evolve star state so cards colour and show stars.

### Phase 3 — Super Ultimate combos  ·  status: pending  ·  detail: phase-03-super-combos.md
Populate `_superSkillBook` so combo skills unlock.

## Success criteria
- Affinity panel on hero detail shows linked heroes as owned + link bonuses active.
- God Evolve / Illustration cards render in colour with stars (not grayscale).
- Super Ultimate combo list shows unlocked combos.
- No pageerrors; owned roster + battle team unaffected.

## Risk
- These are active-progression systems; "fully activated" state format must be reverse-engineered exactly
  (deserialize shapes). Wrong shapes can crash the client → verify each phase with Playwright before moving on.
