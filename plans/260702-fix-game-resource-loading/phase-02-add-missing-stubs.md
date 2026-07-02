# Phase 2: Add Missing Stub JSON Files

## Overview
Two game data JSON keys (`backLoading` and `cellGameTimesBuy`) are requested by the game but don't have corresponding files in the filesystem. Adding minimal stub files prevents 404 errors.

## Implementation
Create minimal valid JSON stubs:

### `decrypted_assets/game_source/resource/json/backLoading.json`
```json
{}
```

### `decrypted_assets/game_source/resource/json/cellGameTimesBuy.json`
```json
{}
```

## Success Criteria
- No 404 warnings for these two keys in browser console
