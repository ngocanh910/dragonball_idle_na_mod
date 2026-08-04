# Capture pipeline

## Phone capture (real APK → real server)

```bash
# One-time phone setup
adb devices                                   # USB debugging ON, phone connected
# 1) Send ~/.mitmproxy/mitmproxy-ca-cert.pem to the phone, install as USER cert
#    (Settings → Security → Install from storage). The real server's TLS is
#    interceptable with a user CA only if the APK has no cert pinning (see tls-test).
# 2) Phone WiFi proxy → <this machine's LAN IP>:8081

# Record a session (starts ON)
./tools/capture/capture.sh                     # → captures/phone-<ts>/
# While playing, flip recording on/off any time:
./tools/capture/toggle.sh off                  # proxy stays up, nothing logged
./tools/capture/toggle.sh on
./tools/capture/toggle.sh status
# Ctrl+C when done → auto-normalizes to actions.jsonl
```

Recording is gated by `captures/.capture-on` (the flag file). `mitmdump` stays running so the phone keeps its proxy connection; only frame logging + screenshots stop. Phone screenshots need `adb-snapshot.mjs` (started by `capture.sh`) and USB still connected.

## Browser capture (emulator client → real server)

`node tools/capture/browser-capture.mjs --domain <host[:port]> [--session <name>] [--auto-login]` — Playwright against the real domain, opens `client/index.html`, captures socket frames + screenshots. Auto-login only emits `User/loginGame` + `User/enterGame`; the rest needs manual UI login in the visible browser.

## Pipeline

Producers (`ws-proxy.mjs`, `adb-snapshot.mjs`) write JSONL per session: exchange lines `{ conn, seq, ts, kind: 'exchange', type, action, req, res }` and notify lines `{ conn, seq, ts, kind: 'notify', type, body }`. `normalize.mjs` converts a session's `flows.jsonl` into unified `actions.jsonl` — schema `{ seq, ts, direction: 'req'|'res'|'notify', type, action, body, screenshot?, uiDump? }` (exported as `ACTION_SCHEMA`), req/res of an exchange sharing `seq` with a shot within 250ms attached. Run: `node tools/capture/normalize.mjs <session>/flows.jsonl <output>/actions.jsonl`.
