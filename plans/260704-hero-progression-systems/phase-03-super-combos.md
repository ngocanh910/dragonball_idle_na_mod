---
spec_id: phase-03-super-combos
status: pending
acceptance_criteria:
  - "❌ _superSkillBook is non-empty after login"
  - "❌ Super Ultimate combo list shows unlocked combos (not all locked/grayscale)"
  - "❌ No client pageerror"
---

# Phase 03 — Super Ultimate combos

## RE findings (verified this session)
- **Current state (probe):** `HerosManager.getInstance()._superSkillBook === {}` (empty).
- `setSuperSkillBook()` is called at the END of `setAlreadyGainHeroID(e)` — which now runs (v1.2.8) with
  132 gained heroes. So the book MAY already partially populate now; **re-probe `_superSkillBook` first**
  before assuming it's still empty.
- `addSuperSkillBook(e)` → `n = getHero(e)` then builds the book entry (needs an owned hero model).
- Combo item UI: `SuperSkillExist(e.superBook.HeroID)` + `getAlreadyGainHeroID()` feed a `fetterGroup`
  (the required-hero row shown on each combo card, e.g. the "Unlock" combos in the Super Ultimate screen).
- **Config:** `superBook.json` (combo definitions, each with a `HeroID` / required heroes), `superAnim.json`,
  `superLevel.json`, `superCompensate.json`.

## Steps
1. Re-probe `_superSkillBook` after the v1.2.8 codex fix — it may now be populated (setSuperSkillBook runs
   after gained=132). If populated → check the Super Ultimate screen visually; may already be improved.
2. If still empty/locked: RE `setSuperSkillBook()` body to see what it iterates (likely gained heroes +
   `superBook.json`) and why entries aren't added. Populate the missing state (per-hero super-skill unlock),
   possibly via a socket handler the combo screen calls (watch `[Fallback] No handler for type=...`).
3. Ensure combos whose required heroes are all owned show as unlocked.

## Verify
- Playwright: Super Ultimate screen shows unlocked combos; `page.evaluate` → `_superSkillBook` non-empty.
- 0 pageerrors.
