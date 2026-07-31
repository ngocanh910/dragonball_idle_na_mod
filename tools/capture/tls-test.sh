#!/usr/bin/env bash
# TLS gate: is the real server's TLS interceptable with a user-installed CA?
# Usage: ./tls-test.sh            # run mitmdump + adb-snapshot, then drive the app
set -euo pipefail
SESSION="tls-test-$(date +%H%M%S)"
export CAP_SESSION="$SESSION"   # addon reads CAP_SESSION; it ignores --set session=
node tools/capture/adb-snapshot.mjs "$SESSION" &
ADB_PID=$!
trap 'kill $ADB_PID 2>/dev/null' EXIT
echo "1) On phone: Settings → Install user cert (mitmproxy CA from ~/.mitmproxy/mitmproxy-ca-cert.pem, email it to yourself)."
echo "2) Phone WiFi proxy → $(hostname -I | awk '{print $1}'):8081"
echo "3) Open the game, do a few actions."
mitmdump -s tools/capture/mitm-hooks/addon.py -p 8081 --set session="$SESSION" 2>&1 | tee "$PWD/captures/$SESSION/mitm.log"
echo "Result file: captures/$SESSION/flows.jsonl"
