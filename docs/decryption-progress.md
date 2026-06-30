# Decryption Progress Report

## Status: ✅ FULLY DECRYPTED

## 1. Native Library RE (libgavesec.so)

- **Functions identified**: AES (custom C++), SHA1, XXTEA decrypt
- **JNI bridge**: `com.utils.EncryptUtil.nativeEncrypt` + `nativeAES`
- **Encryption**: XXTEA with key XOR'd from `"onepiecedecryptk"` + key material
- **Java decrypt class**: `cointhreat/.../customreading.java`

## 2. Decrypted Files

| Encrypted File | Size | Decrypted Format | Content |
|---|---|---|---|
| `pschent_full_tired.bin` | 9.0 MB | **ZIP** | Main game JS code + ALL JSON data (434 files) |
| `voyage_fancy_radius.bin` | 1.2 MB | **ZIP** | index.html + Egret engine JS |
| `vvcc_tc.bin` | 11 KB | **JSON** | Asset path mapping (obfuscated→real), 139 entries |
| `vvcc.bin` | 184 KB | **Binary data** | Asset path mapping (comprehensive) |

## 3. Game Source Code (decoded)

### JavaScript Files
- `main.min_7eae4d6e.js` (4.5 MB) — Core game logic
- `battlelogic.min_394b3477.js` (308 KB) — Battle system
- `blockmessage.min_4c0caf6b.js` (376 KB) — Messaging
- `game.min_16249d0f.js`, `egret.min_*.js`, `eui.min_*.js` — Engine
- `dragonBones.min_6252b9c4.js` (256 KB) — Skeleton/character animation
- `socket.io.min_57ea9db7.js` — WebSocket networking

### Game Data (434 JSON files)
- **hero.json** — 803 hero definitions with stats, types, skills
- **skill.json** — 1765 skill definitions
- **heroEvolve.json** — 170 evolution paths
- **thingsID.json** — 1524 items/equipment/things
- **equip.json** — 84 equipment types
- **weapon.json** + weaponStrengthen.json — Weapons + upgrade (3000 entries)
- **expeditionEvent.json** — 4200 expedition events
- **lesson.json** — 611 quest/lesson levels
- **trainingEnemy.json** — 300 training enemies
- **guildBOSS.json** — 420 guild boss entries
- **language.json** — All game text in 7 languages

### Graphics (assets)
- **2,067 PNG files** (65.6 MB) — Sprites, UI, characters, effects
- **156 JPG files** — Backgrounds
- **78 version files** — Game config versions
- Asset mapping available in `vvcc.json`

## 4. Architecture

```
HTML5 Entry: index.html (canvas 720×1280, 30fps)
  ↓
Egret Engine (TypeScript → JavaScript)
  ├── main.min.js ─── Core game loop
  ├── battlelogic.min.js ─── Combat system
  ├── socket.io ─── WebSocket multiplayer/networking
  └── resource/json/* ─── All game data (JSON)
  ↓
Android Wrapper (via WebView or EgretNativeAndroid)
  ├── LaunchActivity (splash + config)
  ├── MainActivity (game host + JS Bridge)
  └── QuickGame SDK (login, payment)
```

## 5. Backend API Requirements

Based on code analysis:
- **HTTP Config**: GET `{EntryPoint}/setting_{sdk}_Android.bin`
- **Auth**: GET `{EntryPoint}/loginchecknative?uid=...&token=...&os=Android`
- **WebSocket**: `socket.io` for realtime game features

## Output Locations

```
decrypted_assets/
├── pschent_decrypted.bin → extracted/ → game_source/
│   ├── js/                ← 14 game JS files
│   └── resource/json/     ← 434 JSON data files
├── voyage.bin → extracted/ → voyage_extracted/
│   ├── index.html         ← HTML entry point
│   └── manifest_ts.json   ← JS loader manifest
├── vvcc_tc.json           ← Asset mapping (obfuscated→real)
├── vvcc.json              ← Comprehensive asset mapping
└── game_source/
    ├── js/
    ├── resource/json/
    └── resource/language/ ← 7 language packs

review_images/              ← 40 sample graphics for review
```
