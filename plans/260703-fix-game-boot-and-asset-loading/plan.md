# Plan: Fix Game Boot & Asset Loading — 2026-07-03

## Status: 🟢 Game boots, logs in, enters battle scene, shows hero list
## Current Blockers: No real hero images, missing VVCC mappings, no actual battle execution

## Phases

### Phase 1: Hero Image Assets (RE Needed)
- [ ] RE complete VVCC mapping from APK — missing hero_icon_long (154), hero_stand (~200), hero_picture (200)
- [ ] Alternative: decode obfuscated file naming to bootstrap missing mappings
- [ ] Until full RE: use only VVCC-mapped heroes (1205, 1206, 1207, 1309 have real images)

### Phase 2: Game Data Completeness
- [ ] Handle more API actions: user/getBulletinBrief, hero/getAttrs with real hero IDs
- [ ] Save hero team changes to server (action: hangup/startGeneral, etc.)
- [ ] Handle item/currency updates (processHandler responses)
- [ ] Tutorial guide flow — either complete or skip

### Phase 3: Battle Execution
- [ ] Make actual battle start work (hangup action handler)
- [ ] Battle logic — at minimum fake a win result
- [ ] Post-battle reward flow

### Phase 4: Polish
- [ ] Real sound (RE MP3 decryption from APK)
- [ ] Proper language-cn_json (currently returns {} — missing translations)
- [ ] Remove placeholder patches once real data is available

## Pending Research Questions
1. Where is the full VVCC mapping in the original APK? (vvcc.json in assets/ may have more entries)
2. How are hero_stand animation frames named? (hero_stand_XXXX.NNNNN pattern)
3. Is vvcc_tc.json the only supplement, or are there more mapping files?

