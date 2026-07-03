# 📌 CONTINUE-HERE — Hướng dẫn tiếp tục cho phiên Claude sau

> File này là **điểm vào** cho phiên làm việc tiếp theo. Đọc theo đúng thứ tự bên dưới rồi tiếp tục
> nhiệm vụ đang dang dở. Cập nhật lần cuối: 2026-07-03.

---

## 🎯 TL;DR — Đang làm gì, làm tiếp cái gì

**Dự án:** Reverse-engineer game "Dragon Ball Idle" (Egret/HTML5, APK 2021) → dựng **emulator server
Node.js** để chạy game offline trong trình duyệt.

**Tiến độ:** Game đã boot → login → vào Home → battle scene → Hero list → top-up gems (tất cả hoạt động,
đã verify bằng Playwright). Chi tiết ở changelog.

**✅ ĐÃ XONG (2026-07-03, phiên Windows):** Lấy **art thật** của hero/UI từ thiết bị người dùng qua `adb`.
- Máy: Xiaomi "garnet", Android 14, **KHÔNG root**. Nhưng app bật legacy storage nên cache external đọc
  được qua adb: `/sdcard/Android/data/com.guan.wangys/files/game/https/dragonh5cdn.popoh5.com/bs/resource`.
- Đã `adb pull` 1007 file / 67 MB → `real-art/resource/` (đã .gitignore). Đường dẫn trên đĩa = đúng
  logical `/resource/...` nên KHÔNG cần map VVCC.
- Đã tích hợp: `server/src/routes/real-art.routes.js` (mount `/resource` TRƯỚC `registerAll` để thắng
  placeholder; dùng lại rewrite `zh_cn→en→public`). Verify Playwright: login splash + Bulma render art
  thật, 0 pageerror. Chi tiết: changelog **[1.2.2]** + `plans/260703-extract-real-art-from-device/`.

**BƯỚC TIẾP THEO (nếu muốn phủ art nhiều hơn):** Vài overlay vẫn xanh lá (file KHÔNG có trong cache — máy
chỉ cache cái đã xem trong game). Muốn đầy đủ hơn: mở nhiều màn hình trên điện thoại (collection full
hero, shop, arena...) để game cache thêm, rồi `adb pull` lại. Hoặc Track A (bắt CDN `dragonh5cdn.popoh5.com`
nếu còn sống) — xem Phase 1/2.

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

> ⚠️ **Có 2 máy dev.** File này gốc viết trên **Linux** (`/home/admin1/Downloads/folder_code_smali`,
> node v24, adb `/usr/bin/adb`). Phiên 2026-07-03 mục real-art chạy trên **Windows**
> (`c:\Users\PC\Desktop\dragonballidle\dragonball_idle_na_mod`, node v20, Git Bash). Ghi chú cả hai.

- **Windows:** node đã có trong PATH (`node -v` = v20). adb ở
  `C:\Users\PC\AppData\Local\Android\Sdk\platform-tools\adb.exe`. Khi chạy adb với đường dẫn `/sdcard/...`
  trong Git Bash, PHẢI đặt `export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*"` để không bị mangle path.
- **Linux (gốc):** `export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"`; adb `/usr/bin/adb`.
- **Chạy server:** `node server/src/index.js` từ thư mục project (chạy background). Server ở
  **http://127.0.0.1:8080**, entry: `http://127.0.0.1:8080/index.html`. Nếu EADDRINUSE 8080: trên Windows
  `netstat -ano | grep :8080` rồi kill PID; trên Linux `pgrep -af "server/src/index.js"`.
- **Playwright ĐÃ cài** (node_modules + chromium). Script test để **trong thư mục project**, chạy
  `node ./pw-xxx.js`, xóa sau khi xong. Luồng login: username (345,828) → gõ → password (345,949) → gõ →
  PLAY (345,1075) → server "Local Emulator" (197,587) → PLAY lại. Viewport 720x1280.

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
