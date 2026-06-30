# API Protocol + Build Fix Report

## 1. BUILD FIX (✅ Hoàn thành)

### Vấn đề
```
aapt: First type is not attr!
```
aapt yêu cầu resource type `attr` phải là type đầu tiên trong public.xml, nhưng `anim` lại đứng trước.

### Giải pháp
Dùng apktool với flag **`--use-aapt2`**:
```bash
apktool b . --use-aapt2 --output game_build.apk
```

APK build thành công, kích thước 100MB, đầy đủ:
- classes.dex (6.7MB)
- resources.arsc (844KB)  
- AndroidManifest.xml
- 3665 files tổng cộng

### APK build
- Output: `/home/admin1/Downloads/folder_code_smali/game_build.apk`

---

## 2. API PROTOCOL (✅ Hoàn thành)

### 2.1 Entry Points (config.properties)

File `assets/config.properties` và `assets/config_BS.properties` chứa base64-encoded URLs:

| Key | Decoded URL |
|---|---|
| EntryPoint1 | `http://dragon.sjmobilegame.com:82/lzceshi/native_setting/Android` |
| BS EntryPoint1 | `https://configus.sjmobilegame.com/bs/db/android` |
| BS EntryPoint2 | `https://configus-1257066086.cos.na-siliconvalley.myqcloud.com/bs/db/android` |

Cơ chế: App đọc `config.properties` → decode base64 → lấy URL. Nếu file `config_{sdkName}.properties` tồn tại (với sdkName từ config server), dùng file đó thay thế.

### 2.2 Luồng Request

#### A) Fetch Version Config
```
GET {EntryPoint}/setting_{sdkName}_Android.bin?rnd={random}
GET {EntryPoint}/{packageName_underscored}.bin?rnd={random}
```
- Headers: `Connection: close`
- Timeout: exponential backoff (5s, 10s, 30s, ...) × max 3 hoặc 10 lần
- Nếu 404 → dùng config local từ assets/game/

#### B) Login/Auth
```
GET {EntryPoint}/loginchecknative?{params}os=Android&sdk={sdkName}
```
Params (URL-encoded):
| Param | Source |
|---|---|
| osVersion | Build.VERSION.SDK_INT |
| packageName | context.getPackageName() |
| appVersion | versionCode |
| sourceVersion | "20200418" (hardcoded) |
| brand | Build.BRAND |
| model | Build.MODEL |
| uid | QuickGame SDK |
| username | QuickGame SDK |
| token | QuickGame SDK |
| usermode | "1" (guest) / "0" |

Response JSON:
```json
{"code": 0, "msg": "..."}
// hoặc
{"code": 1, "message": "error reason"}
```
- code == 0: success → proceed to game
- code != 0: show error dialog

#### C) Download Game Assets
```
GET {baseUrl}/tmp.zip  → download → unzip → game assets
```
Cơ chế: Download zip → giải nén → copy từng file vào thư mục game với rename pattern.

### 2.3 Version Config (setting_{sdkName}_Android.bin)

File này là JSON chứa:
```json
{
  "sdkName": "tên_sdk",
  "versionCode": "version_number",
  // ... cấu hình game
}
```
Response trả về plain text (readLine từ HTTP stream).

### 2.4 JS Bridge API (giữa game JS và native)

MainActivity.singersmooth class với @JavascriptInterface:

| Method | Mô tả |
|---|---|
| `changeLanguage(str)` | Đổi ngôn ngữ game |
| `changeView()` | Chuyển view |
| `pei(str)` | **Nạp tiền (IAP)** |
| `giveLike(str)` | Like/quảng cáo |
| `openURL(str)` | Mở URL |
| `contact()` | Liên hệ hỗ trợ |
| `refresh()` | Refresh game |
| `report2Third(str)` | Gửi event tracking |
| `startGame()` | Start game với params |

### 2.5 Các SDK tích hợp

| SDK | Chức năng |
|---|---|
| QuickGame SDK | Core account: login (Huawei 94Hi, Facebook, Google, Line, Twitter), payment, user center |
| Facebook SDK | Facebook login, share, App Events |
| Google Sign-In | Google login |
| Google Play Billing v3.0.2 | Google Play payment |
| AppsFlyer | Attribution tracking |
| Adjust | Analytics |
| Firebase | Push notifications, crash reporting |
| FastJSON (JSON library) | Bundled trong code obfuscated |

### 2.6 Security

- **libgavesec.so**: JNI native library với AES/SHA1 encryption (`nativeEncrypt`, `nativeAES`)
- **ProGuard**: Toàn bộ code game và QuickGame SDK bị obfuscated
- **Base64**: Config URLs được encode base64
- **Cleartext traffic**: `network_security_config.xml` cho phép HTTP (cleartext)

---

## 3. KIẾN NGHỊ

### Để dựng backend giả lập:

1. **Minimal server cần hỗ trợ:**
   - `GET /lzceshi/native_setting/Android/setting_{sdkName}_Android.bin` → trả về version config JSON
   - `GET /lzceshi/native_setting/Android/{packageName}.bin` → trả về app config
   - `GET /lzceshi/native_setting/Android/loginchecknative?{params}` → trả về `{"code":0}`

2. **Để hiểu thêm encryption:**
   - RE ngược `libgavesec.so` (Ghidra) để lấy key AES dùng cho game asset encryption
   - Tìm nơi gọi `nativeEncrypt`/`nativeAES` trong code Java

3. **Để build game chạy local:**
   - Phân tích JS game trong assets (các file .bin cần giải mã)
   - Điều chỉnh URL trong config.properties về localhost

---

## 4. RESOURCES

- Built APK: `./game_build.apk` (build với `apktool --use-aapt2`)
- JADX source: `./jadx_output/sources/`
- Config: `./assets/config.properties`, `./assets/config_BS.properties`
- Native lib: `./lib/arm64-v8a/libgavesec.so` (AES/SHA1 JNI)
