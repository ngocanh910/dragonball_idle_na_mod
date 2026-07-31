# Design Spec: Capture & Replay-Diff Pipeline for Dragon Ball Idle

> Date: 2026-07-31 · Status: Approved (design) · Owner: dev
> Goal: capture real-game behavior from the live server (phone MITM + browser) and
> measure how closely the local emulator mirrors it, so the backend can be aligned
> to the real server endpoint-by-endpoint.

## 1. Problem

We are rebuilding a backend that mirrors the real Dragon Ball Idle server. The client
was fully RE'd (socket protocol, request types, DB configs all live in
`decrypted_assets/` + SQLite). What is missing is ground truth about the **live
server's actual responses** and a way to **measure how close the emulator already is**.
Without that, backend work is guesswork.

## 2. Goal & Non-Goals

**Goal:** capture every user action on the real app (network payloads + screenshot +
UI tree, time-aligned), then replay each action into the local emulator and diff the
responses to produce a per-endpoint fidelity report.

**Non-goals (this iteration):**
- APK injection hooks (hướng C) — only if A+B prove insufficient.
- Auto-driving the phone via adb — the user taps manually.
- A UI dashboard — markdown report is enough.
- Full coverage of all 62 client types — capture what the user actually touches.

## 3. Architecture

```
[ Phone (Xiaomi, no root) ]
   │  WiFi proxy → mitmproxy (host)
   │  USB/adb → screencap + uiautomator dump
   ▼
captures/<session>/
   flows.jsonl      (A: HTTP + Socket.IO frames, mitmproxy addon)
   shots/NNNN.png   (A: per-network-event screenshots, time-aligned)
   ui/NNNN.xml      (A: uiautomator UI trees)

[ Browser capture ]  (B: emulator client pointed at the REAL server)
   ▼
captures/<session>/browser.jsonl   (socket.io frames + screenshots, no TLS issue)

        ▼  tools/capture/normalize.mjs
captures/<session>/actions.jsonl   (unified: ts, direction, type, action,
                                    payload, response, screenshot, uiDump)

        ▼  tools/replay/diff-engine.mjs  ──▶ local emulator (socket.io client)
        ▼
reports/replay-diff-report.md      (% fidelity per endpoint + mismatches)
```

## 4. Components

### 4.1 TLS gate (`tools/capture/tls-test.sh`)
5-minute check before committing to path A:
1. Start mitmproxy on the host.
2. Install the mitmproxy CA on the phone (Settings → user cert).
3. Set the phone WiFi proxy to the host.
4. Open the game; watch mitmproxy.

**Decision:** readable JSON responses → **A is primary**. Cert refused / pinned / empty
→ **A paused, B becomes primary**.

### 4.2 Path A — Phone MITM (`tools/capture/mitm-hooks/addon.py` + `tools/capture/adb-snapshot.mjs`)
- mitmproxy addon (Python) logs every HTTP request/response and every WebSocket
  Socket.IO frame (`handler.process` / callback / `Notify`) to `flows.jsonl`, one JSON
  object per line with `ts` (epoch ms), direction, `type`/`action` (extracted from
  payload when present), full payload, full response, content-type.
- On every flow event the addon signals the host shell to run
  `adb exec-out screencap -p > shots/<ts>.png` and `adb shell uiautomator dump` →
  `ui/<ts>.xml` — same `ts` so everything aligns. (Signalling via a socket/HTTP
  localhost endpoint on the host that the addon pokes; the adb script is a tiny
  Node `adb-snapshot.mjs` watcher to avoid Python↔Node coupling.)
- Screenshot cadence: 1 per flow event is enough (bursts coalesced to ≥1/sec).
- If the phone disconnects, capture keeps running (no dependency on the app).

### 4.3 Path B — Browser capture (`tools/capture/browser-capture.mjs`)
- Playwright opens the emulator client (which is the real client) pointed at the
  **real server domain** (the one already RE'd from the APK).
- Intercept `socket.io` frames (page `socket.io-client` connect → `handler.process`
  emit/ack) and HTTP via `page.route`, log to `browser.jsonl` in the same shape as A.
- Screenshot when the UI changes (poll via `page.screenshot` on a short interval or
  on network events) + optional `uiautomator`-like DOM snapshot (skip — browser DOM
  not needed; screenshot + URL + frames suffice).
- No TLS issues: browser trusts whatever the user lets it (mitm CA installable, or
  plain capture).
- Account risk: uses the real account on a "modified" client. Acceptable; user's call.

### 4.4 Normalizer (`tools/capture/normalize.mjs`)
- Reads either `flows.jsonl` (A) or `browser.jsonl` (B) → emits **`actions.jsonl`**:
  `{ ts, direction: 'req'|'res'|'notify', type, action, payload, response, screenshot, uiDump }`.
- Coalesces burst screenshots by `ts`; drops noise (pure statics, `pong`).

### 4.5 Replay-diff engine (`tools/replay/diff-engine.mjs`)
- Connects to the **local emulator** with a `socket.io-client` (v2) using the captured
  session's auth (login flow replayed first if needed).
- For each captured `req` action: send `handler.process(payload)` → get emulator
  response → **deep-diff** against the captured real response (normalized: keys,
  scalars; ignore volatile fields: `serverTime`, `_lastLoginTime`, `sign`, timestamps).
- Output `reports/replay-diff-report.md`: per-`type`/`action` fidelity % + a sample of
  mismatched fields (path + expected vs got).

## 5. Data & File Layout

```
tools/capture/
  tls-test.sh
  mitm-hooks/addon.py
  adb-snapshot.mjs
  browser-capture.mjs
  normalize.mjs
tools/replay/
  diff-engine.mjs
captures/<session>/            (gitignored — regenerable, may be large)
  flows.jsonl | browser.jsonl
  shots/  ui/
  actions.jsonl
reports/replay-diff-report.md  (gitignored or committed? → commit summary only)
```

`captures/` and `reports/` are gitignored (large screenshots); the report is
regenerated on demand.

## 6. Error Handling

| Failure | Behavior |
|---|---|
| TLS refused on phone (path A) | Log + switch B as primary; A marked skipped. |
| Phone disconnects mid-session | adb-snapshot keeps polling; flows keep appending. |
| App crashes mid-session | Capture unaffected (records what was sent up to crash). |
| Emulator auth differs from capture | diff-engine replays login against emulator first; reports auth mismatch as a finding. |
| JSON parse error on a frame | Record raw + `error` marker; skip diff for that frame. |

## 7. Testing & Verification

- **Smoke (each path):** run capture on one short flow (login → open hero list). Assert
  `actions.jsonl` is ordered, has both req+res, and screenshots align by `ts`.
- **Replay-diff:** after a capture, run diff-engine against the emulator; assert the
  report renders per-endpoint rows with sensible numbers (login/getServerList ≈ 100%
  expected; unimplemented types ≈ 0%).
- **Manual:** user does a real phone session; confirms screenshots + flows appear.

## 8. Out of Scope (YAGNI)

- APK-inject capture (hướng C) — revisit only if A+B can't see in-memory state.
- Auto-playing the phone / input automation.
- Web dashboard for reports.
- Frida / root tooling.

## 9. Open Questions

- Real server domain for Path B — confirm from the RE'd client (`serverItem.url` /
  the base URL embedded in `main.min_7eae4d6e.js` or `voyage_extracted`).
- Whether the live server uses a single socket host for all of `url/dungeonurl/
  chaturl` (likely yes — one host, different room ids) — affects B's endpoint target.
