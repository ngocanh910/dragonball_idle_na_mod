---
spec_id: phase-02-god-evolve-stars
status: pending
acceptance_criteria:
  - "❌ God Evolve / Illustration cards render in colour (not grayscale)"
  - "❌ Cards show god-evolve stars > 0 where expected"
  - "❌ No client pageerror"
---

# Phase 02 — God Evolve stars (神觉醒)

## RE findings (verified this session)
- Codex "gained" is already 132 (v1.2.8 fix). Counter shows **132/159**, first card (Shenron, dragonSoul)
  renders in colour. The other cards stay grayscale with EMPTY stars (☆☆☆☆☆).
- **Card colour/star code (heroBook/God-Evolve item):**
  `T = I[n.id] ? true : false` where `I = getAlreadyGainHeroID()` (now true for all 132);
  `y = a ? n.star - 5 : n.star` (stars shown = `y`); star sprites `L.visible = y > S`;
  `ToolCommon.anyIsEnableOrNotColor(T, r)` applies grayscale to icon `r` based on `T`.
- **Puzzle to resolve first:** `T` is now true for all, yet the screenshot still showed grayscale for
  lv200 cards. Two hypotheses to test:
  (a) **Timing** — the God-Evolve view built its cells BEFORE the `heroImage/getAll` socket response
      populated the gained list (re-open after data loads → colour). Test by ensuring getAll resolves
      before opening, and by re-entering the screen.
  (b) **Separate check** — the God-Evolve (神觉醒) screen is distinct from the plain 图鉴 Illustration and
      tints by god-evolve STAR, not `T`. Confirm which view class the "God Evolve" tab uses.
- **Star source:** `getHeroBookDataModel(id, level, evolveLevel, star, isRed)` — `star` comes from
  `heroBookInfo.star`. Find where per-hero god-evolve `star`/`evolveLevel` is stored (server state) and
  whether `heroBookInfo` derives from owned-hero data or a separate god-evolve collection.
- **Config:** `superEvolve.json`, `heroEvolve.json` (170 entries), `heroBook.json` (has static `star`,
  `evolveLevel` per entry — may be the max, not the player's current).

## Steps
1. First resolve the puzzle (a vs b) with a Playwright probe: after full load, open God Evolve, read a
   cell's filter state + `n.star`; re-open to test timing. Grep the "God Evolve" view class + its item setter.
2. If (a) timing → ensure gained list is populated before the view builds (send gained data in enter-game,
   or trigger heroImage/getAll earlier). If (b) → find + populate per-hero god-evolve star/evolveLevel state.
3. Implement the minimal state that makes cards colour + show stars; verify no crash.

## Verify
- Playwright screenshot of God Evolve: cards in colour with gold stars, matching the List screen.
- 0 pageerrors.
