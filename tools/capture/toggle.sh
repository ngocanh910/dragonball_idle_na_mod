#!/usr/bin/env bash
# Toggle recording on/off. mitmdump stays up (phone keeps proxy connectivity);
# this only flips whether frames are logged + phone screenshots taken.
set -euo pipefail
FLAG="captures/.capture-on"
case "${1:-}" in
  on)    touch "$FLAG"; echo "capture ON — frames + screenshots will be recorded";;
  off)   rm -f "$FLAG";  echo "capture OFF — proxy up, nothing recorded";;
  status) [ -f "$FLAG" ] && echo "ON" || echo "OFF";;
  *) echo "usage: toggle.sh on|off|status"; exit 1;;
esac
