# Decryption Progress (Archived)

> **Note:** This document is preserved for historical reference.  
> The project has been restructured into a mod platform. See [architecture.md](./architecture.md).

## Status: ✅ FULLY DECRYPTED

## 1. Native Library RE (libgavesec.so)

- **Functions identified**: AES (custom C++), SHA1, XXTEA decrypt
- **JNI bridge**: `com.utils.EncryptUtil.nativeEncrypt` + `nativeAES`
- **Encryption**: XXTEA with key XOR'd from `"onepiecedecryptk"` + key material
- **Java decrypt class**: `cointhreat/.../customreading.java`

## 2. Decrypted Files

| Encrypted File | Size | Decrypted Format | Content |
|---|---|---|---|
| `pschent_full_tired.bin` | 9.0 MB | ZIP | Main game JS code + ALL JSON data (434 files) |
| `voyage_fancy_radius.bin` | 1.2 MB | ZIP | index.html + Egret engine JS |
| `vvcc_tc.bin` | 11 KB | JSON | Asset path mapping (obfuscated→real) |
| `vvcc.bin` | 184 KB | Binary | Asset path mapping (comprehensive) |

## 3. Output Locations

```
decrypted_assets/
├── pschent_decrypted.bin → game_source/
│   ├── js/                ← 14 game JS files
│   └── resource/json/     ← 434 JSON data files
├── voyage.bin → voyage_extracted/
│   ├── index.html         ← HTML entry point
│   └── manifest_ts.json   ← JS loader manifest
├── vvcc_tc.json           ← Asset mapping (obfuscated→real)
├── vvcc.json              ← Comprehensive asset mapping
└── game_source/
    ├── js/
    └── resource/json/
```
