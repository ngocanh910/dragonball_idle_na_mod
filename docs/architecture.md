# Dragon Ball Idle — Mod Platform Architecture

<!-- owner: refactor | last-updated-by: main | date: 2026-07-01 -->

## Tổng quan

**Project:** Dragon Ball Idle NA Mod — Emulator server + mod platform  
**Game gốc:** Dragon Adventure idle (DragonBall) — Egret Engine (HTML5/Canvas)  
**Package:** `com.guan.wangys`  
**APK gốc:** `DragonBall_WEB_20211216.apk` (Dec 2021)

## Kiến trúc hệ thống

```
┌──────────────────────────────────────────────────────────────────┐
│                      DRAGON BALL IDLE MOD                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    server/                                │   │
│  │  Node.js Express + Socket.IO emulator server              │   │
│  │  ┌──────────┐  ┌──────────┐  ┌───────────────────────┐   │   │
│  │  │ routes/  │  │ handlers/│  │ socket/               │   │   │
│  │  │ • config │  │ • player │  │ • verify challenge    │   │   │
│  │  │ • auth   │  │ • hero   │  │ • handler.process     │   │   │
│  │  │ • api    │  │ • item   │  │ • keep-alive          │   │   │
│  │  │          │  │ • skill  │  └───────────────────────┘   │   │
│  │  │          │  │ • equip  │                               │   │
│  │  │          │  │ • guild  │  ┌───────────────────────┐   │   │
│  │  │          │  │ • fallbk │  │ services/             │   │   │
│  │  │          │  └──────────┘  │ • game-data           │   │   │
│  │  └──────────┘               └───────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           │                                      │
│              ┌────────────┴────────────┐                        │
│              ▼                         ▼                         │
│  ┌────────────────────┐  ┌────────────────────────┐             │
│  │     game-data/     │  │       mods/             │             │
│  │  434 JSON data     │  │ • Hook system           │             │
│  │  • hero.json       │  │ • Example mods          │             │
│  │  • skill.json      │  │ • Unlimited diamonds    │             │
│  │  • thingsID.json   │  │ • Unlock all heroes     │             │
│  │  • ...             │  └────────────────────────┘             │
│  └────────────────────┘                                         │
│                           │                                      │
│              ┌────────────┴────────────┐                        │
│              ▼                         ▼                         │
│  ┌────────────────────┐  ┌────────────────────────┐             │
│  │      tools/        │  │    decrypted_assets/    │             │
│  │ • debug-client     │  │ • game_source/js       │             │
│  │ • data-explorer    │  │ • game_source/resource  │             │
│  │ • apk-build        │  │ • voyage_extracted      │             │
│  └────────────────────┘  └────────────────────────┘             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  APK Build Assets (kept for mod APK rebuild)              │   │
│  │  • AndroidManifest.xml  • res/  • lib/  • assets/        │   │
│  │  • apktool.yml          • debug.keystore                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
dragonball_idle_na_mod/
├── server/                    # ★ Main emulator server
│   ├── src/
│   │   ├── index.js           # Entry point
│   │   ├── config/            # Server configuration
│   │   ├── routes/            # HTTP route handlers
│   │   ├── handlers/          # Game domain logic
│   │   ├── socket/            # Socket.IO handlers
│   │   ├── services/          # Business services
│   │   └── utils/             # Helpers (response, encryption)
│   └── package.json
├── game-data/                 # ★ Game data query API
│   └── index.js               # Loader & query interface
├── mods/                      # ★ Mod system
│   ├── api.js                 # Hook system
│   ├── index.js               # Mod loader
│   └── examples/              # Example mods
├── tools/                     # ★ Development tools
│   ├── debug-client.js        # Test API requests
│   ├── data-explorer.js       # Explore game JSON data
│   └── apk-build.js           # Build mod APK
├── docs/                      # Documentation
│   ├── architecture.md        # This file
│   ├── modding-guide.md       # How to write mods
│   └── development-guide.md   # Development workflow
├── assets/                    # Original encrypted game assets (APK build)
├── decrypted_assets/          # Decrypted game source (JS + JSON data)
├── lib/                       # Native .so libraries (APK build)
├── res/                       # Android resources (APK build)
├── AndroidManifest.xml        # Android manifest (APK build)
├── apktool.yml                # Apktool config (APK build)
├── debug.keystore             # Debug signing key
└── project.summary.txt        # Original RE summary
```

## Công nghệ

| Layer | Technology |
|-------|-----------|
| Server runtime | Node.js 18+ |
| HTTP framework | Express 4.x |
| Real-time | Socket.IO 4.x |
| Compression | lz-string (mirrors game's compression) |
| Game data | 434 JSON files in `decrypted_assets/game_source/resource/json/` |

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/lzceshi/native_setting/Android/setting_Android.bin` | Server version config |
| GET | `/lzceshi/native_setting/Android/com.guan.wangys.bin` | SDK config |
| ALL | `/lzceshi/native_setting/Android/loginchecknative` | Login/auth |
| POST | `/api` | Main game API |
| POST | `/*` | Catch-all for other POST paths |

## Game API Protocol

The game sends requests as form-encoded POST with a `data={JSON}` field:

```json
{
  "type": "hero",
  "action": "list",
  "userId": 1001
}
```

Response format:
```json
{
  "ret": 0,
  "data": "{ \"heros\": [...], \"total\": 803 }"
}
```

The `data` field is a JSON-stringified string (with optional LZ-UTF16 compression when `compress: true`).

## Mod System

See [modding-guide.md](./modding-guide.md) for the full mod development guide.
