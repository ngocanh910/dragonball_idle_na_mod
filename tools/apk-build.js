#!/usr/bin/env node

// ============================================================
// APK Build Helper
// Automates building, aligning, and signing the mod APK.
//
// Prerequisites:
//   - apktool (in PATH or APKTOOL_PATH env)
//   - zipalign (Android SDK build-tools)
//   - apksigner (Android SDK build-tools)
//
// Usage:
//   node tools/apk-build.js build         # build apk
//   node tools/apk-build.js sign          # sign an already-built apk
//   node tools/apk-build.js install       # install on connected device
//   node tools/apk-build.js all           # build → sign → install
// ============================================================

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..');
const APKTOOL = process.env.APKTOOL_PATH || 'apktool';
const KEYSTORE = path.join(ROOT, 'debug.keystore');
const KEYSTORE_PASS = 'android';
const KEY_ALIAS = 'debug';
const OUTPUT = path.join(ROOT, 'game_mod_build.apk');
const ALIGNED = path.join(ROOT, 'game_mod_aligned.apk');

const [, , command] = process.argv;

function run(cmd, label) {
  console.log(`\n▶ ${label}...`);
  try {
    execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
    console.log(`✓ ${label} complete`);
  } catch (err) {
    console.error(`✗ ${label} failed: ${err.stderr?.toString() || err.message}`);
    process.exit(1);
  }
}

function build() {
  run(
    `${APKTOOL} b . --use-aapt2 --output "${OUTPUT}"`,
    'Building APK with apktool',
  );
}

function align() {
  run(
    `zipalign -f -v 4 "${OUTPUT}" "${ALIGNED}"`,
    'Aligning APK with zipalign',
  );
}

function sign() {
  if (!fs.existsSync(KEYSTORE)) {
    console.error(`\n✗ Keystore not found at ${KEYSTORE}`);
    console.error('  Generate one: keytool -genkey -keystore debug.keystore -alias debug -storepass android -keypass android -dname "CN=Developer"');
    process.exit(1);
  }
  run(
    `apksigner sign --ks "${KEYSTORE}" --ks-pass pass:${KEYSTORE_PASS} --ks-key-alias ${KEY_ALIAS} "${OUTPUT}"`,
    'Signing APK',
  );
}

function install() {
  run(
    `adb install -r "${ALIGNED}"`,
    'Installing APK on device',
  );
}

// ── Dispatch ─────────────────────────────────────────────────

switch (command) {
  case 'build':
    build();
    break;
  case 'align':
    align();
    break;
  case 'sign':
    sign();
    break;
  case 'install':
    install();
    break;
  case 'all':
    build();
    align();
    sign();
    install();
    break;
  default:
    console.log(`
Usage:
  node tools/apk-build.js build      Build APK with apktool
  node tools/apk-build.js align      Zipalign the APK
  node tools/apk-build.js sign       Sign the APK
  node tools/apk-build.js install    Install on connected device
  node tools/apk-build.js all        Build → Align → Sign → Install
`);
}
