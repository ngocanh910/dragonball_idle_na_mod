# Dragon Ball Idle — Project Architecture & RE Status

<!-- owner: reverse-engineer | last-updated-by: main | date: 2026-06-30 -->

## 1. Tổng quan dự án

| Field | Value |
|---|---|
| **Tên game** | Dragon Adventure idle (gốc: DragonBall) |
| **Gói** | `com.guan.wangys` |
| **Engine** | Egret Engine (HTML5/TypeScript → WebGL/Canvas) |
| **APK gốc** | `DragonBall_WEB_20211216.apk` (Dec 2021) |
| **SDK min/max** | Android 21 → Android 30 |
| **Version** | 1.0.1 (code 1) |

---

## 2. Kiến trúc hệ thống

```
┌──────────────────────────────────────────────────────────────────┐
│                     ANDROID WRAPPER (APK)                        │
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────────┐  │
│  │  Application │    │LaunchActivity│    │   MainActivity    │  │
│  │  .onCreate() │───→│  (splash +   │───→│ (game host + JS   │  │
│  │  lifecycle   │    │   loading)   │    │  bridge)          │  │
│  └──────────────┘    └──────────────┘    └───────┬───────────┘  │
│                                                  │              │
│          ┌───────────────────────────────────────┘              │
│          ▼                                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              EGERT NATIVE RUNTIME                        │   │
│  │  libegret.so (17MB) + runtime-dex.jar (84KB)            │   │
│  │  ┌──────────────────────────────────────────────────┐   │   │
│  │  │  EgretNativeAndroid.initialize(url)              │   │   │
│  │  │  EgretNativeAndroid.getRootFrameLayout()         │   │   │
│  │  │  EgretNativeAndroid.callExternalInterface()      │   │   │
│  │  │  EgretNativeAndroid.setExternalInterface()       │   │   │
│  │  └──────────────────────────────────────────────────┘   │   │
│  │  Fallback: WebView (nếu EgretNativeAndroid không có)    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           THIRD-PARTY SDKs                              │   │
│  │  • QuickGame SDK (Huawei 94Hi login, payment, account) │   │
│  │  • Facebook SDK (login, share, App Events)             │   │
│  │  • Google Sign-In + Google Play Billing v3.0.2         │   │
│  │  • AppsFlyer + Adjust (attribution, analytics)         │   │
│  │  • Firebase (push, crash, analytics)                   │   │
│  │  • ZXing (QR code scan)                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │           NATIVE SECURITY LIB                            │   │
│  │  libgavesec.so — AES-128 + SHA-1 (JNI bridge)           │   │
│  │  Java: com.utils.EncryptUtil                            │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                           │
         JS Bridge API     │  (jsbind.* + setExternalInterface)
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                     HTML5 GAME (Egret Engine)                    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    index.html                            │   │
│  │  Canvas 720×1280, 30fps, WebGL mode                     │   │
│  │  Loader: manifest_ts.json → load JS modules             │   │
│  └──────────────────────┬───────────────────────────────────┘   │
│                         ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │             GAME ENGINE & LOGIC                          │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │  Egret core   │  egret.min.js, egret.web.min.js │   │   │
│  │  │  UI framework │  eui.min.js, default.thm.js     │   │   │
│  │  │  Animation    │  dragonBones.min.js (skeleton)  │   │   │
│  │  │  Tween        │  tween.min.js                   │   │   │
│  │  │  Assets mgr   │  assetsmanager.min.js           │   │   │
│  │  │  Compress     │  lz-string.min.js, md5.min.js   │   │   │
│  │  │  Networking   │  socket.io.min.js (WebSocket)   │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │     main.min.js (4.5MB) — GAME CORE LOGIC       │   │   │
│  │  │     battlelogic.min.js — BATTLE SYSTEM           │   │   │
│  │  │     blockmessage.min.js — CHAT/MESSAGING         │   │   │
│  │  │     game.min.js — GAME FRAMEWORK                 │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         │                                       │
│                         ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │        GAME DATA (434 JSON files)                       │   │
│  │  • hero.json — 803 heroes                               │   │
│  │  • skill.json — 1765 skills/abilities                   │   │
│  │  • heroEvolve.json — 170 evolution paths                │   │
│  │  • thingsID.json — 1524 items/things                    │   │
│  │  • equip.json + weapon.json — equipment/weapons         │   │
│  │  • expeditionEvent.json — 4200 events                   │   │
│  │  • lesson.json — 611 quest levels                       │   │
│  │  • trainingEnemy.json — 300 enemies                     │   │
│  │  • guildBOSS.json — 420 guild boss entries              │   │
│  │  • weaponStrengthen.json — 3000 upgrade entries         │   │
│  │  • signLevelUp.json — 1920 sign-in entries             │   │
│  │  • language.json — 7618 text keys (7 languages)         │   │
│  │  • ... and 420+ more data files                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                         │                                       │
│                         ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │            GRAPHICS (2,223 files — 65.6 MB)              │   │
│  │  • PNG: 2,067 files — sprites, UI, characters, effects   │   │
│  │  • JPG: 156 files — backgrounds                          │   │
│  └─────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
                           │
          HTTP + Socket.io │  (config.properties → EntryPoint URL)
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                    BACKEND SERVER                                │
│                                                                  │
│  EntryPoint: dragon.sjmobilegame.com:82                         │
│  API:      POST /lzceshi/.../{type, action, data}               │
│  Socket:   Socket.IO (verify → handler.process → Notify)        │
│  Config:   GET /lzceshi/.../{...}.bin → version config          │
│  Login:    GET /lzceshi/.../loginchecknative?params             │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Tình trạng Reverse Engineering

| Thành phần | Trạng thái | Mức độ | Ghi chú |
|---|---|---|---|
| Android wrapper (Java) | ✅ Hoàn thành | 100% | JADX decompile, 3 classes chính |
| JS Bridge API | ✅ Hoàn thành | 100% | 10 methods (@JavascriptInterface) |
| QuickGame SDK (login) | ✅ Hoàn thành | 100% | Login, logout, bind, user center |
| QuickGame SDK (payment) | ⚠️ Một phần | 60% | Luồng pei (IAP) đã rõ, test cần server thật |
| Facebook SDK | ✅ Hoàn thành | 100% | Login, share, tracking |
| API Protocol | ✅ Hoàn thành | 100% | URL pattern, request/response format |
| Socket.io protocol | ✅ Hoàn thành | 100% | verify → handler.process → Notify |
| TEA/XXTEA encryption | ✅ Hoàn thành | 100% | Thuật toán + key từ customreading.java |
| **Game JS code** | ✅ Hoàn thành | 100% | Decrypted từ ZIP trong .bin |
| **Game data (JSON)** | ✅ Hoàn thành | 100% | 434 files, đầy đủ hero, skill, item |
| **Graphics** | ✅ Hoàn thành | 100% | 2,223 PNG+JPG, view được bình thường |
| **Game assets (encrypted)** | ✅ Hoàn thành | 100% | Giải mã XXTEA → ZIP → JS + JSON |
| libgavesec.so (native AES) | ✅ Hoàn thành | 100% | Export symbols rõ, dùng cho game asset encrypt |
| Server emulator (Node.js) | ✅ Hoàn thành | 100% | Express + Socket.io, load game data |
| Mod APK build | ✅ Hoàn thành | 100% | apktool --use-aapt2 + sign + install |
| Lưu lượng mạng giữa client-server | ⚠️ Một phần | 40% | Cần test thực tế để capture thêm |

---

## 4. Cấu trúc thư mục dự án

```
folder_code_smali/
├── AndroidManifest.xml         # Manifest gốc (đã mod provider authorities)
├── apktool.yml                 # Config apktool
├── assets/                     # Game assets gốc
│   └── game/                   #   Encrypted game files (bin, png, jpg, ...)
├── smali/                      # Smali code (6108 files)
├── kotlin/                     # Kotlin builtins
├── lib/                        # Native libraries (.so)
├── res/                        # Android resources
├── original/                   # Original META-INF
├── unknown/                    # Unknown files from apktool
├── build/                      # Apktool build cache
├── jadx_output/                # ⚠️ JADX decompile output (163 MB)
│   └── sources/                #   Java source code
├── decrypted_assets/           # ⚠️ Decrypted game files (75 MB)
│   ├── game_source/            #   Game JS + JSON data
│   │   ├── js/                 #     14 JS files
│   │   └── resource/json/      #     434 JSON data files
│   └── voyage_extracted/       #   Egret entry point (index.html)
├── server/                     # Node.js backend emulator
│   ├── server.js               #   Main server code
│   ├── package.json            #   Dependencies
│   └── node_modules/           #   ⚠️ Dependencies (npm)
├── review_images/              # ⚠️ Image review samples (29 MB)
├── game_mod_v3_aligned.apk     # ✅ Mod APK cuối cùng (101 MB)
├── debug.keystore              # ⚠️ Keystore cho signing
├── docs/                       # Documentation
│   ├── project-architecture.md #   File này
│   ├── decryption-progress.md  #   Decryption report
│   ├── code-standards.md       #   Code standards
│   └── design-standards.md     #   Design standards
├── plans/                      # Plans & reports
│   └── reports/                #   Research reports
└── .gitignore                  # Git ignore rules
```

---

## 5. Cách mod game local

### 5.1 Chạy server local
```bash
cd server/
npm install     # (lần đầu)
node server.js  # chạy server
```
Server lắng nghe tại `http://0.0.0.0:8080` với:
- `GET /lzceshi/.../*.bin` — version config + server list
- `GET /lzceshi/.../loginchecknative` — login auth
- `POST /api` — game data RPC (hero, skill, item, ...)
- Socket.io — realtime messaging

### 5.2 Sửa config trỏ về IP local
```bash
# Encode URL mới
echo -n "http://YOUR_IP:8080/lzceshi/native_setting/Android" | base64

# Sửa trong assets/config.properties
EntryPoint1=<base64_encoded_url>
EntryPoint1_debug=<base64_encoded_url>

# Tương tự cho assets/config_BS.properties
```

### 5.3 Build APK
```bash
# Build
apktool b . --use-aapt2 --output game.apk

# Zipalign (4-byte align)
zipalign -f -v 4 game.apk game_aligned.apk

# Sign (v1+v2+v3)
apksigner sign --ks debug.keystore --ks-pass pass:android \
  --ks-key-alias debug game_aligned.apk

# Install lên máy
adb install game_aligned.apk
```

### 5.4 Sign keystore
```bash
# Tạo keystore mới (nếu chưa có)
keytool -genkey -v -keystore debug.keystore -alias debug \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass android -keypass android \
  -dname "CN=Debug, OU=Debug, O=Debug, L=Debug, S=Debug, C=US"
```

### 5.5 Một số lưu ý
- Android và PC phải **cùng mạng WiFi**
- Server phải chạy **trước** khi mở game
- Khi đổi IP → rebuild APK
- Package `com.guan.wangys.mod` → cài song song với bản chính
- Cần gỡ bản mod khi update bản chính (provider authorities conflict)

---

## 6. Cấu hình Android Manifest đã mod

Để cài song song với bản chính, cần đổi:
```xml
<!-- apktool.yml -->
renameManifestPackage: com.guan.wangys.mod

<!-- Provider authorities (sửa tay trong AndroidManifest.xml) -->
com.facebook.app.FacebookContentProvider5636354178086351815 → .mod
com.guan.wangys.FacebookInitProvider → com.guan.wangys.mod.FacebookInitProvider
com.guan.wangys.fileprovider → com.guan.wangys.mod.fileprovider
```

---

## 7. Hướng phát triển tiếp theo

| Hướng | Mô tả | Độ khó |
|---|---|---|
| Hoàn thiện server emulator | Implement đầy đủ các handler (chat, guild, activity, shop, ...) | ⭐⭐ |
| Mod game data (JSON) | Sửa hero stats, skill, item, giá trong JSON → rebuild asset ZIP → upload lên server | ⭐ |
| Mod JS code | De-obfuscate game JS, sửa logic gameplay, UI, thêm tính năng | ⭐⭐⭐⭐ |
| Reverse đầy đủ network protocol | Dùng proxy/mitmproxy để capture traffic thật giữa game và server | ⭐⭐ |
| Tách backend riêng | Dựng server thật có database cho user, guild, chat | ⭐⭐⭐ |
| Port game ra web | Egret engine là HTML5 → có thể chạy trên browser với index.html | ⭐⭐ |

---

## 8. ADR (Architecture Decision Records)

### ADR-001: XXTEA encryption for game assets
- **Decision:** Game assets (.bin files) được mã hóa bằng XXTEA với key XOR từ `"onepiecedecryptk"`
- **Reason:** Bảo vệ game code JS và dữ liệu khỏi reverse thông thường
- **Date:** 2026-06-30
- **Status:** Active

### ADR-002: Local emulator replacing remote backend
- **Decision:** Xây dựng Node.js server emulator thay vì modify game JS
- **Reason:** Giữ nguyên game code, chỉ redirect URL → dễ maintain khi update
- **Date:** 2026-06-30
- **Status:** Active

### ADR-003: apktool --use-aapt2 + apksigner
- **Decision:** Dùng aapt2 thay vì aapt để build APK, apksigner thay jarsigner
- **Reason:** aapt lỗi "First type is not attr", jarsigner không sign v2/v3 scheme
- **Date:** 2026-06-30
- **Status:** Active
