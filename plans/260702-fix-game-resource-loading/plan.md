# Plan: Fix Game Resource Loading Crash After Pressing Play

## Overview
After logging in, selecting server, and pressing "Play", the game enters the main game state and attempts to load 207+ game data JSON files via `window.loadJsonFunc()`. These requests all fail because the fallback URL generator in `browser-boot.js` produces incorrect paths. The game then crashes with "Cannot read properties of null".

## Root Cause
The `_resourceMap` in `resource-map.js` only contains entries for animation/skeleton/texture assets (from `default.res.json`). Game data JSONs (stored in `/resource/json/`) are NOT in this map, so `loadJsonFunc` falls back to the guess pattern:

```js
url = '/resource/' + path + '.json';  // WRONG — should be /resource/json/...
```

The actual files are at `/resource/json/abilityName.json`, etc. All 207 JSON requests return `{}` (empty stub), and the game crashes on null property access.

## Phases

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Fix `syncFetchJson` fallback URL in `browser-boot.js` | pending |
| 2 | Add missing stub files for `backLoading` & `cellGameTimesBuy` | pending |
| 3 | Verify fix in browser | pending |

## Files to Modify
- `client/browser-boot.js` — Fix fallback URL construction
- `client/resource-map.js` — (optional) Add game data JSON entries for completeness
- `decrypted_assets/game_source/resource/json/` — Add 2 missing stub files

## Test Strategy
1. Launch server, open browser to `http://127.0.0.1:8080`
2. Login → Select server → Press Play
3. Check browser console for `loadJsonFunc` warnings (should be none for game data JSONs)
4. Verify game loads properly without crashes
