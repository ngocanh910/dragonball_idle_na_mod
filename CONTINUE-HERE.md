# 📌 CONTINUE-HERE — Hướng dẫn tiếp tục cho phiên Claude sau

> File này là **điểm vào** cho phiên làm việc tiếp theo. Đọc theo đúng thứ tự bên dưới rồi tiếp tục
> nhiệm vụ đang dang dở. Cập nhật lần cuối: 2026-07-03.

---

## 🎯 TL;DR — Đang làm gì, làm tiếp cái gì

**Dự án:** Reverse-engineer game "Dragon Ball Idle" (Egret/HTML5, APK 2021) → dựng **emulator server
Node.js** để chạy game offline trong trình duyệt.

**Tiến độ:** Game đã boot → login → vào Home → battle scene → Hero list → top-up gems (tất cả hoạt động,
đã verify bằng Playwright). Chi tiết ở changelog.

**NHIỆM VỤ ĐANG DANG DỞ (ưu tiên số 1):** Lấy **art thật + skill thật** của hero từ thiết bị người dùng
(hình hero hiện đang trống vì art không nằm trong APK — nó được tải từ CDN + cache trên máy đã chơi).
→ Kế hoạch: `plans/260703-extract-real-art-from-device/`
→ **Bước tiếp theo chính xác:** người dùng có **Android đã root**. Đang chờ họ **cắm điện thoại vào máy
này qua USB (bật USB debugging)**. Khi `adb devices` thấy máy → chạy Phase 0 (recon) rồi Phase 1/3.

---

## 📖 THỨ TỰ ĐỌC TÀI LIỆU (từ trên xuống)

1. **`CONTINUE-HERE.md`** (file này) — bối cảnh + bước tiếp theo.

2. **`docs/architecture.md`** — hiểu kiến trúc: server/ (Express+Socket.IO), client/browser-boot.js
   (mock JNI bridge để chạy trên browser), game-data/ (434 JSON), decrypted_assets/ (game source + JS
   đã giải mã), assets/game/ (obfuscated qua VVCC).

3. **`docs/project-changelog.md`** — ĐỌC KỸ mục **[1.2.1] - 2026-07-03**. Đây là toàn bộ việc đã làm
   trong phiên gần nhất, gồm: khóa roster 4 hero, tắt guide, các crash đã fix (hangup, expedition,
   currency, checkHasLinkOnBattle), level 200, top-up miễn phí. Mỗi mục ghi rõ root-cause + cách verify.

4. **NHIỆM VỤ CHÍNH — đọc theo thứ tự:**
   - `plans/260703-extract-real-art-from-device/plan.md` — tổng quan 5 phase + điều kiện tiên quyết.
   - `plans/260703-extract-real-art-from-device/research/where-real-art-lives.md` — phân tích kỹ thuật:
     art thật nằm ở đâu trên thiết bị, 2 hướng lấy (A = bắt traffic tìm CDN + tải bulk; B = trích cache
     trên máy), bằng chứng từ native code.
   - `plans/260703-extract-real-art-from-device/phase-00-device-recon.md` → **BẮT ĐẦU TỪ ĐÂY** khi máy
     đã kết nối. Rồi phase-01 (bắt traffic) / phase-03 (trích cache) tùy kết quả recon.

5. **BỐI CẢNH LIÊN QUAN (đọc khi cần hiểu sâu vì sao art thiếu):**
   - `plans/260703-fix-game-boot-and-asset-loading/research/research-vvcc-mapping-reality.md` — chứng minh
     art KHÔNG có trong APK (VVCC mapping đầy đủ nhưng chỉ 2083 asset; ~9500 asset còn lại stream từ CDN
     đã chết). Đây là gốc rễ của toàn bộ vấn đề hình ảnh.
   - `plans/260703-hero-art-rendering/` — kế hoạch **placeholder tự sinh** (giải pháp DỰ PHÒNG nếu không
     lấy được art thật). solution-hero-art-rendering.md + 3 phase. Chỉ làm cái này nếu hướng lấy art thật
     thất bại.

6. **LỊCH SỬ CŨ (chỉ đọc nếu cần):** `plans/260703-fix-game-boot-and-asset-loading/plan.md`,
   `plans/260702-fix-game-resource-loading/`, `plans/reports/*`.

---

## ⚙️ THÔNG TIN VẬN HÀNH (quan trọng — dễ vấp)

- **Node KHÔNG có trong PATH mặc định.** Dùng:
  `export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"` trước mọi lệnh node/npm.
- **Chạy server:** `cd /home/admin1/Downloads/folder_code_smali && node server/src/index.js`
  (nên chạy background). Server ở **http://127.0.0.1:8080**. Entry game: `http://127.0.0.1:8080/index.html`.
  - Server đã được DỪNG sạch cuối phiên. Nếu gặp EADDRINUSE 8080, kiểm tra
    `pgrep -af "server/src/index.js"` và kill process cũ trước khi start.
- **Playwright ĐÃ cài** (node_modules + chromium). Script test phải **để trong thư mục project** (để
  resolve module `playwright`), chạy: `node ./pw-debug-xxx.js`. Xóa file test tạm sau khi xong.
  - Luồng login trong test: click username (345,828) → gõ → password (345,949) → gõ → PLAY (345,1075) →
    chọn server "Local Emulator" (197,587) → PLAY lại. Viewport 720x1280.
- **adb đã cài** (`/usr/bin/adb`, v1.0.41). Hiện `adb devices` TRỐNG — chờ người dùng cắm máy.

---

## 🔑 NGUYÊN TẮC ĐÃ RÚT RA (áp dụng khi fix crash mới)

- Nhiều tính năng bị "khóa" phía sau level/điều kiện. Khi mở khóa (vd level 200), các request `type:"X"`
  chưa có handler sẽ lộ ra → rơi vào `fallback` trả `{}` rỗng → client đọc field không guard → crash.
  **Cách fix chuẩn:** xem server console tìm dòng `[Fallback] No handler for type="X"`, RE hàm client
  tương ứng trong `decrypted_assets/game_source/js/main.min_7eae4d6e.js` để biết field cần, tạo handler
  mới trong `server/src/handlers/X.handler.js` + đăng ký ở `server/src/handlers/index.js`.
- **Luôn verify bằng Playwright** (drive tới đúng màn hình, bắt `pageerror`) — đừng chỉ đoán.
- File game JS chính: `decrypted_assets/game_source/js/main.min_7eae4d6e.js` (KHÔNG bọc IIFE → mọi biến
  như `ts`, `GuideInfoManager`, `ItemsCommonSingleton`, `UserInfoSingleton`, `egret` đều trên `window`,
  gọi được từ Console để chẩn đoán).

---

## 📝 TRẠNG THÁI GIT (chưa commit)

Đã sửa: `client/browser-boot.js`, `docs/project-changelog.md`, `server/src/handlers/{hero,index}.js`,
`server/src/services/enter-game-state.js`, `plans/260703-fix-game-boot-and-asset-loading/plan.md`.
File mới: `server/src/handlers/{hangup,entrust,recharge}.handler.js`,
`server/src/services/hero-roster.js`, và 3 thư mục plan mới + research VVCC.
→ Chưa commit gì. Hỏi người dùng trước khi commit.
