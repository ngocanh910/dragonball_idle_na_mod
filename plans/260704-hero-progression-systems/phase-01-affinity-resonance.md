---
spec_id: phase-01-affinity-resonance
status: pending
acceptance_criteria:
  - "❌ enter-game sends e.resonance; setResonanceModel populates non-empty cabins"
  - "❌ Hero-detail Affinity panel shows linked heroes as Owned (not 'Unowned')"
  - "❌ Link/resonance bonus effects active; no client pageerror"
---

# Phase 01 — Affinity / Resonance links (羁绊)

## RE findings (verified this session)
- **Entry point:** enter-game reads `e.resonance` →
  `HerosManager.getInstance().setResonanceModel(e.resonance)`.
  `setResonanceModel(e){ this.resonanceData = new ResonanceModel; this.resonanceData.deserialize(e) }`.
- **ResonanceModel.deserialize(e):** iterates keys of `e`; for key `_cabins` builds
  `this.cabins[o] = new ResonanceCabin().deserialize(n[o])`; for other `_x` common-typed keys sets
  `this[x] = value` (strips leading underscore). So the payload shape is:
  `{ _cabins: { <cabinId>: <cabin> }, _id, _diamondCabin, _buySeatCount, _totalTalent, _unlockSpecial }`.
- **ResonanceCabin fields:** `id, mainHero (string), diamondSeat, seats {}` (deserialize similar; RE the
  `ResonanceCabin.deserialize` + `ResonanceSeat` shape — grep `ResonanceCabin=function` and `seats`).
- **Current empty state (probe):**
  `resonanceData = {id:"", diamondCabin:0, cabins:{}, buySeatCount:0, totalTalent:0, unlockSpecial:false}`.
- **Config:** `heroConnect.json` (single entry id:1): `cabinNumFree:5, seatNumFree:1, seatNumDiamond:1,
  heroNumberLimit:15, heroStarLimit:10, seatCd:43200`. Also `heroConnectLevelMax.json`,
  `heroConnectSeatBuyTime.json`.
- **Relevant methods:** `checkHeroInResonance`, `getAllResonanceDataDisplayId` (returns [] now),
  `checkHasLinkOnBattle`, `getHeroLinkBuySeatCost`, `getHerosQuaUpperUnlock` (returns
  `resonanceData.unlockSpecial` — the "God quality" upper unlock is tied to resonance!).

## Steps
1. RE `ResonanceCabin.deserialize` + seat/link data model fully (grep the minified defs). Determine what a
   "cabin with heroes placed" looks like and how a LINK is considered active (which hero group → which bonus).
2. Decide scope: (a) minimal — send a valid non-empty resonance so the panel shows owned + `unlockSpecial:true`;
   (b) full — place heroes into cabins/seats to activate each defined link. Start with (a), verify, then (b).
3. Add a `resonance` field to `enter-game-state.js` (new `server/src/services/resonance-state.js` builder,
   keep <200 lines) returning the deserialize-shaped object.
4. Possibly also handle a socket `resonance`/`heroConnect` request type if the client fetches it separately
   (drive to the Affinity screen, watch server log for `[Fallback] No handler for type=...`).

## Verify
- Playwright: open a hero detail → Affinity panel shows the 3 linked heroes as Owned (not "Unowned").
- `page.evaluate` → `HerosManager.getInstance().resonanceData.cabins` non-empty;
  `getAllResonanceDataDisplayId()` returns ids.
- 0 pageerrors; battle/home still fine.
