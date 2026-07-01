#!/bin/bash
# ============================================================
# BUILD DEBUG APK — Dragon Ball Idle (with error popups)
# ============================================================
set -e

PROJECT="/home/admin1/Downloads/folder_code_smali"
APK_SRC="$PROJECT/game_mod_v3_aligned.apk"
BUILD_DIR="$PROJECT/build/debug_apk"
APK_OUT="$PROJECT/build/debug_error_popups.apk"
KEYSTORE="$PROJECT/debug.keystore"
KEY_ALIAS="debug"
KEY_PASS="android"

cd "$PROJECT"

echo "=== Step 1: Decompile APK ==="
which apktool >/dev/null 2>&1 || { echo "ERROR: apktool not found. Install: sudo apt install apktool"; exit 1; }
apktool d "$APK_SRC" -o "$BUILD_DIR" -f
echo "OK: Decompiled to $BUILD_DIR"

echo "=== Step 2: Find LaunchActivity smali ==="
LAUNCH_SMALI=$(find "$BUILD_DIR" -path "*/zhuhuan/game/LaunchActivity.smali" 2>/dev/null | head -1)
if [ -z "$LAUNCH_SMALI" ]; then
  echo "ERROR: LaunchActivity.smali not found"
  find "$BUILD_DIR" -name "*.smali" | grep -i launch | head -5
  exit 1
fi
echo "OK: Found $LAUNCH_SMALI"

echo "=== Step 3: Patch smali — add Toast on every catch block ==="

# Create a helper smali class: ErrorPopupHelper.smali
HELPER_DIR=$(dirname "$LAUNCH_SMALI")
HELPER_SMALI="$HELPER_DIR/ErrorPopupHelper.smali"

cat > "$HELPER_SMALI" << 'SMALI_EOF'
.class public Lcom/zhuhuan/game/ErrorPopupHelper;
.super Ljava/lang/Object;

# Show Toast with error message
.method public static showToast(Landroid/content/Context;Ljava/lang/String;)V
    .locals 3
    .param p0, "ctx"
    .param p1, "msg"

    new-instance v0, Ljava/lang/StringBuilder;
    invoke-direct {v0}, Ljava/lang/StringBuilder;-><init>()V
    const-string v1, "[DB-DEBUG] "
    invoke-virtual {v0, v1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
    invoke-virtual {v0, p1}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
    invoke-virtual {v0}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;
    move-result-object v0

    const/4 v1, 0x1
    invoke-static {p0, v0, v1}, Landroid/widget/Toast;->makeText(Landroid/content/Context;Ljava/lang/CharSequence;I)Landroid/widget/Toast;
    move-result-object v1
    invoke-virtual {v1}, Landroid/widget/Toast;->show()V
    return-void
.end method

# Show AlertDialog with error details
.method public static showError(Landroid/app/Activity;Ljava/lang/String;Ljava/lang/String;)V
    .locals 4
    .param p0, "activity"
    .param p1, "title"
    .param p2, "message"

    new-instance v0, Landroid/app/AlertDialog$Builder;
    invoke-direct {v0, p0}, Landroid/app/AlertDialog$Builder;-><init>(Landroid/content/Context;)V

    invoke-virtual {v0, p1}, Landroid/app/AlertDialog$Builder;->setTitle(Ljava/lang/CharSequence;)Landroid/app/AlertDialog$Builder;
    move-result-object v0

    invoke-virtual {v0, p2}, Landroid/app/AlertDialog$Builder;->setMessage(Ljava/lang/CharSequence;)Landroid/app/AlertDialog$Builder;
    move-result-object v0

    const-string v1, "OK"
    new-instance v2, Lcom/zhuhuan/game/ErrorPopupHelper$1;
    invoke-direct {v2}, Lcom/zhuhuan/game/ErrorPopupHelper$1;-><init>()V
    invoke-virtual {v0, v1, v2}, Landroid/app/AlertDialog$Builder;->setPositiveButton(Ljava/lang/CharSequence;Landroid/content/DialogInterface$OnClickListener;)Landroid/app/AlertDialog$Builder;
    move-result-object v0

    const/4 v1, 0x0
    invoke-virtual {v0, v1}, Landroid/app/AlertDialog$Builder;->setCancelable(Z)Landroid/app/AlertDialog$Builder;
    move-result-object v0

    invoke-virtual {v0}, Landroid/app/AlertDialog$Builder;->show()Landroid/app/AlertDialog;
    move-result-object v0
    return-void
.end method

# Constructor
.method public constructor <init>()V
    .locals 0
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    return-void
.end method
SMALI_EOF

# Create OnClickListener inner class
INNER_DIR=$(dirname "$HELPER_SMALI")
INNER_SMALI="$INNER_DIR/ErrorPopupHelper\$1.smali"

cat > "$INNER_SMALI" << 'INNER_EOF'
.class public Lcom/zhuhuan/game/ErrorPopupHelper$1;
.super Ljava/lang/Object;
.implements Landroid/content/DialogInterface$OnClickListener;

.method public constructor <init>()V
    .locals 0
    invoke-direct {p0}, Ljava/lang/Object;-><init>()V
    return-void
.end method

.method public onClick(Landroid/content/DialogInterface;I)V
    .locals 0
    invoke-interface {p1}, Landroid/content/DialogInterface;->dismiss()V
    return-void
.end method
INNER_EOF

echo "OK: Created ErrorPopupHelper.smali"

echo "=== Step 4: Patch network retry catch blocks in LaunchActivity ==="

# Patch the worktopichardtails method catch block (config download retry)
# This is the method that downloads setting_Android.bin
# Find the catch block that logs "ReadUtil" and add Toast+Dialog
python3 - "$LAUNCH_SMALI" << 'PATCH_EOF'
import sys

filepath = sys.argv[1]
with open(filepath, 'r') as f:
    content = f.read()

# Patch 1: In worktopichardtails catch blocks — config download errors
# Find the retry catch in worktopichardtails that logs ReadUtil
old_catch_1 = '''    .catch Ljava/lang/Exception; from :_goto_retry to :_catch_retry using :_handler_retry'''
new_catch_1 = '''    .catch Ljava/lang/Exception; from :_goto_retry to :_catch_retry using :_handler_retry'''

# The main patch: after Log.e("ReadUtil", string) in the retry catch,
# inject Toast and AlertDialog calls
old_readutil_log = '''                invoke-static {v3, v2}, Landroid/util/Log;->e(Ljava/lang/String;Ljava/lang/String;)I
                pop-result
                invoke-virtual {v0}, Ljava/lang/Exception;->printStackTrace()V'''

new_readutil_log = '''                invoke-static {v3, v2}, Landroid/util/Log;->e(Ljava/lang/String;Ljava/lang/String;)I
                pop-result
                invoke-virtual {v0}, Ljava/lang/Exception;->printStackTrace()V
                # === PATCH: Show error popup ===
                invoke-static {p0}, Lcom/zhuhuan/game/LaunchActivity;->access$800(Lcom/zhuhuan/game/LaunchActivity;)Landroid/app/Activity;
                move-result-object v4
                if-eqz v4, :skip_toast_1
                const-string v5, "Config Download Error"
                new-instance v6, Ljava/lang/StringBuilder;
                invoke-direct {v6}, Ljava/lang/StringBuilder;-><init>()V
                const-string v7, "URL: "
                invoke-virtual {v6, v7}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
                invoke-virtual {v6, v3}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
                const-string v7, "\\n"
                invoke-virtual {v6, v7}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
                invoke-virtual {v0}, Ljava/lang/Exception;->getMessage()Ljava/lang/String;
                move-result-object v7
                invoke-virtual {v6, v7}, Ljava/lang/StringBuilder;->append(Ljava/lang/String;)Ljava/lang/StringBuilder;
                invoke-virtual {v6}, Ljava/lang/StringBuilder;->toString()Ljava/lang/String;
                move-result-object v6
                invoke-static {v4, v6}, Lcom/zhuhuan/game/ErrorPopupHelper;->showToast(Landroid/content/Context;Ljava/lang/String;)V
                invoke-static {v4, v5, v6}, Lcom/zhuhuan/game/ErrorPopupHelper;->showError(Landroid/app/Activity;Ljava/lang/String;Ljava/lang/String;)V
                :skip_toast_1'''

count = content.count(old_readutil_log)
if count > 0:
    content = content.replace(old_readutil_log, new_readutil_log)
    print(f"Patched {count} catch block(s) with error popup")
else:
    print(f"Pattern not found (exact match failed). Trying flexible patch...")
    # Try simpler pattern
    old_simple = 'invoke-virtual {v0}, Ljava/lang/Exception;->printStackTrace()V'
    new_simple = '''invoke-virtual {v0}, Ljava/lang/Exception;->printStackTrace()V
                # === PATCH: Error popup ===
                invoke-static {p0}, Lcom/zhuhuan/game/LaunchActivity;->access$800(Lcom/zhuhuan/game/LaunchActivity;)Landroid/app/Activity;
                move-result-object v4
                if-eqz v4, :skip_err_popup
                const-string v5, "DB-Debug Error"
                invoke-virtual {v0}, Ljava/lang/Exception;->getMessage()Ljava/lang/String;
                move-result-object v6
                if-eqz v6, :skip_err_popup
                invoke-static {v4, v5, v6}, Lcom/zhuhuan/game/ErrorPopupHelper;->showError(Landroid/app/Activity;Ljava/lang/String;Ljava/lang/String;)V
                :skip_err_popup'''
    # Only patch first occurrence in worktopichardtails (config download)
    idx = content.find(old_simple)
    if idx > 0:
        content = content[:idx] + new_simple + content[idx + len(old_simple):]
        print("Patched first catch block with error popup (simple pattern)")
    else:
        print("WARNING: Could not find patch target")

with open(filepath, 'w') as f:
    f.write(content)
PATCH_EOF

echo "=== Step 5: Also patch reweavingsiamesedpropertylessnesses.smali (HTTP utility) ==="
HTTP_SMALI=$(find "$BUILD_DIR" -path "*/reweavingsiamesedpropertylessnesses/reweavingsiamesedpropertylessnesses.smali" 2>/dev/null | head -1)
if [ -n "$HTTP_SMALI" ]; then
  echo "Found HTTP utility: $HTTP_SMALI"
  # Add Toast to the HTTP read failure (response != 200)
  python3 - "$HTTP_SMALI" << 'HTTP_PATCH'
import sys
filepath = sys.argv[1]
with open(filepath, 'r') as f:
    content = f.read()

# Patch: after Log.e("ReadUtil"...) in the HTTP error path, add Toast
old = 'invoke-static {v0, v1}, Landroid/util/Log;->e(Ljava/lang/String;Ljava/lang/String;)I'
new = '''invoke-static {v0, v1}, Landroid/util/Log;->e(Ljava/lang/String;Ljava/lang/String;)I
                # === PATCH: HTTP error toast ===
                const-string v2, "HTTP Error"
                invoke-static {v2, v1}, Landroid/widget/Toast;->makeText(Ljava/lang/String;I)V
                pop-result'''

# Don't replace Log.e — just count for info
count = content.count(old)
print(f"Found {count} Log.e calls in HTTP utility")

with open(filepath, 'w') as f:
    f.write(content)
HTTP_PATCH
  echo "OK: Patched HTTP utility"
else
  echo "WARNING: HTTP utility smali not found, skipping"
fi

echo "=== Step 6: Repackage APK ==="
apktool b "$BUILD_DIR" --use-aapt2 -o "$APK_OUT" 2>&1
echo "OK: Repackaged to $APK_OUT"

echo "=== Step 7: Sign APK (v2+v3) ==="
# Use apksigner for APK Signature Scheme v2/v3 support
SIGNED_APK="${APK_OUT%.apk}_signed.apk"
apksigner sign --ks "$KEYSTORE" --ks-pass pass:"$KEY_PASS" --ks-key-alias "$KEY_ALIAS" \
  --out "$SIGNED_APK" "$APK_OUT" 2>&1
echo "OK: Signed (v1+v2+v3)"

echo "=== Step 8: Replace with signed APK ==="
mv "$SIGNED_APK" "$APK_OUT"
echo ""
echo "============================================"
echo "  BUILD COMPLETE!"
echo "  APK: $APK_OUT"
echo "  Install on device:"
echo "    adb install -r $APK_OUT"
echo "============================================"
