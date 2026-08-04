#!/usr/bin/env bash
# Phone capture: real APK → real server through mitmproxy, log Socket.IO frames
# + phone screenshots. Recording starts ON; flip with toggle.sh off/on while
# playing. Ctrl+C ends → auto-normalizes to actions.jsonl.
#
# One-time phone setup (see README.md):
#   adb devices                             # USB debugging on
#   install ~/.mitmproxy/mitmproxy-ca-cert.pem on phone as a user cert
#   phone WiFi proxy → $(hostname -I | awk '{print $1}'):8081
set -euo pipefail
SESSION="phone-$(date +%Y%m%d-%H%M%S)"
export CAP_SESSION="$SESSION"   # addon reads env; ignores --set session
FLAG="captures/.capture-on"
mkdir -p "captures/$SESSION"
touch "$FLAG"

echo "Phone capture → captures/$SESSION"
echo "  proxy: $(hostname -I | awk '{print $1}'):8081"
echo "  adb:   $(adb devices 2>/dev/null | awk 'NR>1 && $2=="device"' | wc -l) device(s)"

node tools/capture/adb-snapshot.mjs "$SESSION" &
ADB_PID=$!
trap 'kill $ADB_PID 2>/dev/null; rm -f "$FLAG"' EXIT

echo "Recording ON. Open the game, play. Toggle: tools/capture/toggle.sh off|on. Ctrl+C when done."
mitmdump -s tools/capture/mitm-hooks/addon.py -p 8081 2>&1 | tee "captures/$SESSION/mitm.log"

node tools/capture/normalize.mjs "captures/$SESSION/flows.jsonl" "captures/$SESSION/actions.jsonl"
echo "Done → captures/$SESSION/{flows.jsonl, actions.jsonl}"
