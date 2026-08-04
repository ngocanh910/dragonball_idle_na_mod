---
spec_id: phase-04-integrate-verify
status: pending
blockedBy:
  - phase-02-track-a-bulk-download
  - phase-03-track-b-device-extraction
acceptance_criteria:
  - "❌ Real hero art renders in collection, hero detail (stand/picture/animation), and skill popups"
  - "❌ Still-missing art falls back to placeholders — no blanks, no crashes"
  - "❌ Coverage report: real vs placeholder per category"
---

# Phase 04 — Integrate & verify

## Overview
Combine whatever real art Tracks A/B recovered, confirm serving order, and verify end-to-end. Priority:
HIGH (closes the loop).

## Steps
1. Confirm serving order in `server/src/routes/resource-proxy.routes.js`:
   real bundled art → recovered real art (Track A/B, same logical tree) → placeholder (from the
   `260703-hero-art-rendering` plan). Real files on disk already win over the placeholder fallthrough.
2. Restart server. Playwright drive:
   - Hero collection (0/132) — cards show real icons.
   - One hero detail — real stand + picture + (if recovered) DragonBones animation plays.
   - A skill popup — real skill icon.
   - Assert zero pageerror; the 4 pre-bundled heroes unchanged.
3. Generate a coverage report: for each category, count real-art vs placeholder-served across all hero ids
   (hit each via the proxy or scan disk).
4. Update `docs/project-changelog.md` + close out phases.

## Risk
- Mixed coverage (some real, some placeholder) is the expected/acceptable end state; document it clearly.
