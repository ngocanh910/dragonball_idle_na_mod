# Project Architecture (Archived)

> **Note:** This document is preserved for historical reference from the RE phase.  
> The project has been restructured into a mod platform. See [architecture.md](./architecture.md) and [development-guide.md](./development-guide.md).

## 1. Tổng quan dự án (Original)

| Field | Value |
|---|---|
| **Tên game** | Dragon Adventure idle (gốc: DragonBall) |
| **Gói** | `com.guan.wangys` |
| **Engine** | Egret Engine (HTML5/TypeScript → WebGL/Canvas) |
| **APK gốc** | `DragonBall_WEB_20211216.apk` (Dec 2021) |
| **SDK min/max** | Android 21 → Android 30 |
| **Version** | 1.0.1 (code 1) |

## 2. RE Status (Original)

| Thành phần | Trạng thái | Ghi chú |
|---|---|---|---|
| Android wrapper (Java) | ✅ Hoàn thành | JADX decompile, 3 classes chính |
| JS Bridge API | ✅ Hoàn thành | 10 methods (@JavascriptInterface) |
| QuickGame SDK (login) | ✅ Hoàn thành | Login, logout, bind, user center |
| API Protocol | ✅ Hoàn thành | URL pattern, request/response format |
| Socket.io protocol | ✅ Hoàn thành | verify → handler.process → Notify |
| Game JS code | ✅ Hoàn thành | Decrypted từ ZIP trong .bin |
| Game data (JSON) | ✅ Hoàn thành | 434 files, đầy đủ hero, skill, item |
| Graphics | ✅ Hoàn thành | 2,223 PNG+JPG |
| libgavesec.so (native AES) | ✅ Hoàn thành | Export symbols rõ |
| Server emulator (Node.js) | ✅ Hoàn thành | Express + Socket.io |
| Mod APK build | ✅ Hoàn thành | apktool --use-aapt2 + sign + install |

## 3. API Protocol (Original)

### Entry Points
```
EntryPoint1 → http://dragon.sjmobilegame.com:82/lzceshi/native_setting/Android
BS EntryPoint1 → https://configus.sjmobilegame.com/bs/db/android
```

### Flow
1. GET `{EntryPoint}/setting_{sdkName}_Android.bin` → version config
2. GET `{EntryPoint}/loginchecknative?params` → auth
3. POST with `{type, action, data}` → game API
4. Socket.IO for realtime features
