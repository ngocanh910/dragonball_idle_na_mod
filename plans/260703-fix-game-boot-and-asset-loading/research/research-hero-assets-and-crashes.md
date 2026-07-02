# Research: Hero Assets & Game Crash Chain

## Overview

Today we fixed the complete crash chain from boot → enter game → battle screen. Game now successfully:
1. Boots (loads Egret engine + RES module)
2. Login via Socket.IO + HTTP API
3. Enters game (saveUserData)
4. Navigates to battle scene
5. Shows hero list with clickable hero items
6. Places hero into formation
7. Shows FIGHT button with power calculation

## Crash Chain (Fixed)

Each crash was a cascading failure — earlier bugs blocked later progress.

### Layer 1: Resource Loading
- **loadJsonFunc undefined** → `readJsonFile` returned `null` → JSON data all null → crash on `['201']`
- **Fix:** Added `window.loadJsonFunc` in browser-boot.js with sync XHR fallback
- **Missing .ske.json / .tex.json (DragonBones)** → RES group load failed → `GROUP_LOAD_ERROR`
- **Fix:** Server fallback returns valid empty structure `{version:'5.5', armature:[], SubTexture:[]}`
- **Missing .fnt files** (hero_name.fnt, common3.fnt)
- **Fix:** Server language fallback zh_cn → en → public
- **Missing MP3 files** (guild1.mp3, bgm_main.mp3, sound_click.mp3)
- **Fix:** Server tries voyage_extracted/assets_ts/music/ first, then sends silent MP3

### Layer 2: Server Data
- **config.host = '0.0.0.0'** → response URLs contain `http://0.0.0.0:8080` → browser can't resolve
- **Fix:** Added `config.publicHost` separate from `config.host`
- **Missing enterGame fields:**
  - `hangup._curLess: 0` → lesson[0] undefined → `thisChapter` crash
  - Fix: `_curLess: 10101` (InitialSection)
  - `lastTeam._lastTeamInfo` missing → `_lastTeamInfo` undefined → `reading '9'` crash
  - Fix: Added lastTeam with HANGUP type (9) team entry
  - `heros._heros` empty → `herosInfo` never populated → `HeroList` empty → `reading 'heroId'` crash
  - Fix: Added hero 1205 with full `_heroBaseAttr` and handler for `getAll`/`getAttrs`

### Layer 3: Client Patches (browser-boot.js)
- **Sound crashes:** Multiple classes try to play MP3 via RES.getRes → undefined.play()
- **Fix:** Patch RES.getRes for sound keys + no-op playSound/PlayMusic on all prototypes
- **DragonBones null:** createArmature returns null → addChild(null) → .animation.play() crash
- **Fix:** addChild null guard + TSDragonBones.createArmature returns dummy Sprite
- **HeroList empty:** setAllHeroList runs before readByData populates herosInfo
- **Fix:** injectDefaultHero() runs every 100ms + patch setAllHeroList to inject if empty
- **imageAnimation slice:** heroStand format "image_png,animBase" missing animBase → .slice() crash
- **Fix:** Guard input in imageAnimation + ensure heroStand has comma-separated format

### Layer 4: Missing Image Assets
- **hero_stand_XXXX.NNNNN frames** → 404 from RES module URL generation
- **Fix:** Server intercepts `/hero_stand_*\d+\.\d+$` → returns transparent PNG
- **hero_icon_long / hero_stand images** for hero 1201 don't exist (not decrypted)
- **Current:** Switched to hero 1205 which has decrypted images (stand, icon, picture, still)

## Asset Decryption Status

| Asset Category | Total in default.res.json | Decrypted (on disk) | VVCC Mapped |
|----------------|--------------------------|---------------------|-------------|
| All assets | ~7844 entries | 2524 files | 1944 mappings |
| hero_icon_long | 154 entries | 0 files | 0 mappings |
| hero_icon_short | 100+ | 0 | 0 |
| hero_stand | ~200 | 4 (1205,1206,1207,1309) | 4 |
| hero_picture (jpg) | ~200 | ~5 | ~5 |
| dragon_animation | ~70 | ~70 | 69 |
| bitMapFont (.fnt) | ~80 | 81 | 0 (served via static mount) |
| JSON data | ~434 | 434 | N/A (static mount) |

**Key finding:** VVCC mapping is incomplete. ~580+ files in `assets/game/` are obfuscated but unmapped. Hero icons/stands/stills/pictures are missing from VVCC mapping entirely.

## Files Modified

| File | Changes |
|------|---------|
| `client/browser-boot.js` | loadJsonFunc, JSON pre-cache, ensureHero, sound patches, addChild guard, clickHeroListItem guard, setAllHeroList patch, TSDragonBones patch, imageAnimation guard |
| `server/src/services/enter-game-state.js` | hero data (1205), _curLess fix, lastTeam field |
| `server/src/handlers/hero.handler.js` | getAll handler, getAttrs handler |
| `server/src/routes/resource-proxy.routes.js` | JSON fallback with language/path variants, FNT fallback, MP3 fallback, DragonBones version fix, hero stand frame placeholder |
| `server/src/services/enter-game-state.js` | LastTeam._lastTeamInfo for HANGUP type |

## Next Steps

1. **RE more VVCC mappings** — hero_icon_long, hero_stand, hero_picture, hero_still for all heroes
2. **Proper hero team save** — sync hero lineup changes to server
3. **Battle execution** — make the actual fight work (turn-based logic)
4. **Sound** — RE MP3 decryption from APK for real audio
5. **Tutorial guide** — handle guide step flow (currently pops guide window)

