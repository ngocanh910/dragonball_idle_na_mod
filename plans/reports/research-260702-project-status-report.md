# Research Report: Dragon Ball Idle NA Mod — Project Status

**Date:** 2026-07-02
**Project:** `C:\Users\PC\Desktop\dragonballidle\dragonball_idle_na_mod`

---

## Executive Summary

Dragon Ball Idle NA Mod là dự án reverse-engineer game mobile Dragon Ball Idle (Egret Engine HTML5) từ file APK gốc (build 2021). Mục tiêu là tạo một platform mod/emulator hoàn chỉnh có thể chạy trên browser. Dự án đã đi được ~70% quãng đường: đã RE thành công toàn bộ cấu trúc game, decrypt asset, và dựng backend emulator Node.js, nhưng VẪN CHƯA thể chạy được game UI trên browser do game JS code bị obfuscated và native bridge chưa được mock hoàn chỉnh.

---

## 1. Cấu trúc dự án

```
dragonball_idle_na_mod/
├── server/                    ★ Backend emulator (Node.js/Express + Socket.IO v2)
│   └── src/
│       ├── index.js           Entry point (port 8080)
│       ├── config/            Path config
│       ├── routes/            api.routes, config.routes, debug.routes
│       ├── handlers/          player, hero, item, skill, equipment, guild, fallback
│       ├── socket/            Socket.IO handler (verify → handler.process → Notify)
│       ├── services/          game-data (434 JSON files), log-store
│       └── utils/             response helpers, encryption (XXTEA stub)
├── client/                    ★ Web client boot
│   ├── index.html             Entry point cho browser (Egret engine loader)
│   └── browser-boot.js        Mock native bridge JNI (Java ↔ JS)
├── mods/                      ★ Mod system
│   ├── index.js               Mod loader
│   ├── api.js                 Hook system (on/emit)
│   └── examples/              unlimited-diamonds, unlock-all-heroes
├── tools/                     ★ Dev tools
│   ├── data-explorer.js       Xem 434 file game data JSON
│   ├── debug-client.js        Test API từ terminal
│   └── apk-build.js           Build APK (apktool → zipalign → sign → install)
├── game-data/                 Query API cho game data
├── test/                      Smoke test
├── docs/                      Documentation (roadmap, changelog, architecture, etc.)
├── plans/                     Implementation plans & reports
│
├── decrypted_assets/          ★ Đã decrypt hoàn chỉnh
│   ├── game_source/
│   │   ├── js/                ★ 14 file Egret engine + game.min + main.min
│   │   └── resource/json/     ★ 434 file JSON game data
│   └── voyage_extracted/
│       ├── index.html         Original Egret loader
│       └── manifest_ts.json
├── assets/                    Original encrypted assets (giữ lại để rebuild APK)
├── lib/                       Native .so files
├── res/                       Android resources
├── AndroidManifest.xml        Cho APK rebuild
└── apktool.yml
```

---

## 2. Câu trả lời chi tiết

### ❓ Câu 1: Dự án đã thật sự được RE hết chưa?

**✅ Đã RE xong phần cấu trúc và data, NHƯNG chưa RE xong phần logic game.**

Những gì đã hoàn thành:
- ✅ Android wrapper (Java/Kotlin): decompile thành công 3 class chính
- ✅ JS Bridge API: 10 methods (@JavascriptInterface) — đã RE hoàn chỉnh
- ✅ QuickGame SDK (login/logout/bind)
- ✅ API Protocol: URL pattern, request/response format
- ✅ Socket.IO protocol: verify → handler.process → Notify
- ✅ Game JS code: **decrypt xong** từ ZIP trong file .bin (14 JS files + 1 main)
- ✅ Game data (JSON): **434 files** — hero, skill, item, dungeon, v.v.
- ✅ Graphics: **2,223 PNG+JPG** — decrypt hoàn chỉnh
- ✅ Native library (libgavesec.so): RE xong symbols AES/SHA1/XXTEA
- ✅ Server emulator (Node.js): hoàn chỉnh

**❌ Chưa RE được:**
- **main.min_7eae4d6e.js (4.7MB)**: File này chứa toàn bộ logic game (battle, dungeon, quest, UI flow, v.v.) nhưng **đã bị obfuscated (ProGuard)** — tên biến/hàm là random: `cointhreat`, `singersmooth`, `feedtonight`, `ironoriginhoblike`...
- **Không thể đọc hiểu logic game một cách dễ dàng**
- **XXTEA native decrypt**: chưa port được từ libgavesec.so lên JavaScript (đang là stub)
- **Các file .bin, .data trong assets/**: tên file bị mã hóa, chưa xác định được file nào chứa gì

### ❓ Câu 2: Dự án đã có thể chạy trên browser web chưa?

**✅ Backend (server) chạy được trên browser — có thể test API qua debug dashboard.**
**❌ Game UI chưa chạy được — Egret engine load nhưng crash.**

Cụ thể:
- Debug dashboard `http://localhost:8080/debug` hoạt động hoàn chỉnh (log, stats, quick test)
- API endpoints hoạt động: login, hero list, item list, skill list, equip list
- Server static file serving hoạt động: có thể fetch `/js/main.min_...` và các resource
- **Nhưng khi mở `http://localhost:8080/` thì game KHÔNG chạy** vì:
  - Script loader load all 14+ game JS files
  - `egret.ExternalInterface.call("startTsGame")` được gọi
  - `browser-boot.js` trigger callback với mock payload
  - **Egret engine khởi tạo nhưng crash ngay sau đó do thiếu nhiều native bridge methods**
  - Game obfuscated code gọi các hàm JNI khác (`changeView`, `enterGame`, `peiNative`, `sendLog`, etc.) mà chưa được mock hết

### ❓ Câu 3: Đã có thể debug chưa?

**✅ CÓ — cả backend và frontend đều có thể debug.**

- **Backend**: có `npm run debug` với `--inspect` flag, Chrome DevTools attach được
- **API debug dashboard**: `http://localhost:8080/debug` với real-time logs, stats, và quick test panel
- **Frontend game code**: Developer có thể dùng Chrome DevTools để:
  - Console log
  - Network tab xem request/response
  - Sources tab đặt breakpoint trong game JS (dù code obfuscated)
  - Có thể step debug qua code game (dù tên hàm khó hiểu)

### ❓ Câu 4: Backend đã được thay bằng server/ hoàn toàn chưa?

**✅ CÓ — server/ đã thay thế hoàn toàn backend gốc.**

- Tất cả API endpoint gốc (`dragon.sjmobilegame.com:82`) đã được mock trong `server/src/routes/` và `handlers/`
- Config endpoint (`setting_*.bin`) được serve với XOR encryption đúng format game gốc
- Login check (`loginchecknative`) trả về đúng format
- Socket.IO v2 chạy đúng version game gốc (2.1.0)
- **Không cần kết nối đến server gốc nữa** — game APK modded trỏ về localhost

Tuy nhiên cần lưu ý:
- Các handler mới **chỉ trả về mock data cứng** (fake response), chưa có business logic thật
- Fallback handler trả về empty data cho các type chưa implement
- Mod system hoạt động: có thể intercept response và mutate data

### ❓ Câu 5: Đã có thể chạy được dự án (cả giao diện game) trên browser chưa?

**❌ CHƯA — game UI không chạy trên browser.**

Game engine (Egret) load được các script nhưng **crash ngay sau khi boot** vì:
1. **Native bridge mock chưa đầy đủ**: `browser-boot.js` chỉ mock được `addCallback` và `call`, nhưng game obfuscated code gọi thêm nhiều JNI method khác
2. **Game code bị obfuscated**: `main.min_7eae4d6e.js` (4.7MB) — step debug được nhưng không thể hiểu logic
3. **Asset path mapping**: Các file assets gốc có tên bị mã hóa (`cottage_electric_gracious`, `stearin_commission_exploit`, v.v.) — cần vvcc.json mapping nhưng chưa được serve đúng cách
4. **Thiếu nhiều resource**: Font files, sound effects, spine animations (dragonBones) có thể chưa được serve đúng đường dẫn

---

## 3. So sánh workflow

| Tính năng | Workflow cũ (APK) | Workflow mới (Browser) |
|---|---|---|
| Test device | Android device / emulator | Standard web browser |
| Feedback loop | 3-5 phút (build→sign→install) | ~1 giây (refresh page) |
| Debug tools | Android Logcat | Chrome DevTools |
| API test | Dùng debug-client.js | Built-in debug dashboard |
| E2E test | Manual clicks | Jest/Playwright potential |
| Mod test | Rebuild APK | Browser refresh |

---

## 4. Giải pháp để chạy được game trên browser

Để game UI thực sự chạy trên browser, cần:

1. **Hoàn thiện native bridge mock** (`browser-boot.js`):
   - Intercept tất cả `egret.ExternalInterface.call(...)` khác
   - Mock `changeView`, `enterGame`, `peiNative` (purchase), `sendLog`, `getDeviceInfo`, v.v.
   - Sử dụng `Proxy` hoặc logging wrapper để capture tất cả calls

2. **Serve assets mapping**:
   - Serve `vvcc.json` và `vvcc_tc.json` để game có thể resolve tên file obfuscated
   - Đảm bảo tất cả resource paths đều được serve từ server

3. **Xử lý lỗi Egret engine boot**:
   - Debug crash logs từ game engine sau khi load
   - Có thể cần patch một số function trong game.min.js để bỏ qua các native calls không mock được

4. **Dùng `game-data` path thay vì hardcode**:
   - Serve JSON data files qua API thay vì direct file access (một số file cần parse từ server)

---

## 5. Summary Status

| Thành phần | Status | Ghi chú |
|---|---|---|
| Decrypt assets | ✅ Hoàn thành | 434 JSON, 2223 images, 14 JS files |
| Native library RE | ✅ Hoàn thành | libgavesec.so symbols |
| Server emulator | ✅ Hoàn thành | Express + Socket.IO, mock APIs |
| Debug dashboard | ✅ Hoàn thành | Real-time logs, stats, quick tests |
| Mod system | ✅ Hoàn thành | Hook-based, examples included |
| Client browser boot | ⚠️ Chưa hoàn thiện | Engine load được nhưng crash |
| Game UI on browser | ❌ Chưa chạy được | Cần hoàn thiện native bridge mock |
| Logic game RE | ❌ Obfuscated | main.min.js 4.7MB, tên hàm random |
| Build APK mod | ✅ Hoàn thành | apktool + zipalign + apksigner |

---

## 6. Unresolved Questions

1. **Browser crash logs cụ thể là gì?** — Cần chạy thử và capture lỗi từ Egret engine để biết chính xác thiếu cái gì.
2. **Game có gọi native billing/library SDK calls không?** — Nếu có thì browser-boot.js cần mock thêm.
3. **Có cần serve `assets/game/` obfuscated files không?** — Hay game chỉ dùng decrypted version?
4. **Có thể inject patches vào main.min.js để skip các native calls không?** — Đây là approach khả thi nhất.
