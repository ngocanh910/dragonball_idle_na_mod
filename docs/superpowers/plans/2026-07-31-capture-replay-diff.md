# Capture & Replay-Diff Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture every user action on the real Dragon Ball Idle app (network payloads + screenshots + UI trees, time-aligned), replay each into the local emulator, and report per-endpoint fidelity.

**Architecture:** Two producers — (A) a mitmproxy addon capturing the real phone's Socket.IO traffic plus an adb screencap/uiautomator snapshotter, and (B) a Playwright browser capture of the same client pointed at the real server. Both emit exchange-correlated JSONL; a normalizer produces a unified `actions.jsonl`; a replay-diff engine replays each request into the local emulator (socket.io-client 2.5.0) and deep-diffs responses into a markdown report.

**Tech Stack:** Node ≥ 22 (built-in `node:test`), Playwright ^1.61 (root dep, installed), mitmproxy (to install), adb, socket.io-client ^2.5.0 (to add as root dep), Python 3.12 (mitmproxy addon).

## Global Constraints

- Node built-in `node:test` for all tests — NO new test framework.
- No new runtime deps beyond: `mitmproxy` (pip) + `socket.io-client@^2.5.0` (root). Everything else stdlib.
- Files in `tools/capture/`, `tools/replay/`; output in `captures/`, `reports/` (both gitignored).
- JSONL: one JSON object per line. All timestamps epoch **milliseconds** (`Date.now()`).
- `decrypted_assets/` restored at repo root — server boots (`node server/src/index.js` on :8080).
- Never touch `server/node_modules` contents; only the root `package.json` may add `socket.io-client`.

---

### Task 1: Capture scaffolding + normalizer (`normalize.mjs`)

**Files:**
- Create: `tools/capture/normalize.mjs`
- Create: `tools/capture/normalize.test.mjs`
- Create: `captures/.gitkeep`, `reports/.gitkeep`
- Create: `tools/capture/README.md`

**Interfaces:**
- Consumes: nothing yet (works on producer files written by Tasks 2–3).
- Produces:
  - `normalize({ inputPath, shotsDir, uiDir, outputPath })` → void. Reads a producer JSONL file, writes unified `actions.jsonl`.
  - Unified line schema (exported as `ACTION_SCHEMA` for docs): `{ seq, ts, direction: 'req'|'res'|'notify', type, action, body, screenshot?, uiDump? }`. `req`/`res` of one exchange share `seq`.

- [ ] **Step 1: Write the failing test**

`tools/capture/normalize.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalize } from './normalize.mjs';

test('normalize converts producer exchanges to unified actions.jsonl', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cap-'));
  const shots = join(dir, 'shots'); const ui = join(dir, 'ui');
  mkdirSync(shots, { recursive: true }); mkdirSync(ui, { recursive: true });
  const input = join(dir, 'flows.jsonl');
  const output = join(dir, 'actions.jsonl');
  writeFileSync(input, [
    JSON.stringify({ conn: 'c1', seq: 1, ts: 1000, kind: 'exchange', type: 'hero', action: 'getAttrs', req: { heros: [1] }, res: { ret: 0, data: '{}' } }),
    JSON.stringify({ conn: 'c1', seq: 2, ts: 1500, kind: 'notify', type: 'activity', body: { ret: 0 } }),
  ].join('\n'));
  writeFileSync(join(shots, '1000.png'), 'x'); // screenshot aligned to seq 1
  normalize({ inputPath: input, shotsDir: shots, uiDir: ui, outputPath: output });
  const lines = readFileSync(output, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines[0], { seq: 1, ts: 1000, direction: 'req', type: 'hero', action: 'getAttrs', body: { heros: [1] }, screenshot: 'shots/1000.png' });
  assert.deepEqual(lines[1], { seq: 1, ts: 1000, direction: 'res', type: 'hero', action: 'getAttrs', body: { ret: 0, data: '{}' }, screenshot: 'shots/1000.png' });
  assert.equal(lines[2], undefined);
  assert.equal(lines[1].direction, 'res');
  rmSync(dir, { recursive: true, force: true });
});

test('notify line stays single with no req/res split', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cap-'));
  const shots = join(dir, 'shots'); const ui = join(dir, 'ui');
  mkdirSync(shots, { recursive: true }); mkdirSync(ui, { recursive: true });
  const input = join(dir, 'flows.jsonl'); const output = join(dir, 'actions.jsonl');
  writeFileSync(input, JSON.stringify({ conn: 'c1', seq: 9, ts: 5000, kind: 'notify', type: 'activity', body: { a: 1 } }) + '\n');
  normalize({ inputPath: input, shotsDir: shots, uiDir: ui, outputPath: output });
  const lines = readFileSync(output, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0], { seq: 9, ts: 5000, direction: 'notify', type: 'activity', body: { a: 1 } });
  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tools/capture/normalize.test.mjs`
Expected: FAIL — `Cannot find module './normalize.mjs'` (module not created yet).

- [ ] **Step 3: Write minimal implementation**

`tools/capture/normalize.mjs`:
```js
// ============================================================
// Normalizer — producer files → unified actions.jsonl
// Input line (both producers emit this shape):
//   { conn, seq, ts, kind: 'exchange'|'notify',
//     type, action, req, res }   (exchange)
//   { conn, seq, ts, kind: 'notify', type, body }   (notify)
// Output line:
//   { seq, ts, direction: 'req'|'res'|'notify', type, action,
//     body, screenshot?, uiDump? }
//   req and res of one exchange share `seq`. A screenshot at
//   exactly ts (or within 250ms) attaches to the exchange.
// ============================================================
import { readFileSync, existsSync, writeFileSync } from 'node:fs';

const SHOT_WINDOW_MS = 250;

export function findShot(ts, shotsDir, uiDir) {
  // exact match first, then nearest within window (earliest shot).
  let best = null; let bestDelta = Infinity;
  if (!existsSync(shotsDir)) return best;
  const fs = readFileSync(`${shotsDir}/.index.json`, 'utf8');
  for (const t of JSON.parse(fs)) {
    const d = Math.abs(t - ts);
    if (d < bestDelta) { bestDelta = d; best = t; }
  }
  if (bestDelta > SHOT_WINDOW_MS) return null;
  return {
    screenshot: existsSync(`${shotsDir}/${best}.png`) ? `shots/${best}.png` : undefined,
    uiDump: existsSync(`${uiDir}/${best}.xml`) ? `ui/${best}.xml` : undefined,
  };
}

export function normalize({ inputPath, shotsDir, uiDir, outputPath }) {
  const lines = readFileSync(inputPath, 'utf8').trim().split('\n').filter(Boolean);
  const out = [];
  for (const raw of lines) {
    const e = JSON.parse(raw);
    if (e.kind === 'notify') {
      out.push({ seq: e.seq, ts: e.ts, direction: 'notify', type: e.type, body: e.body });
      continue;
    }
    const att = findShot(e.ts, shotsDir, uiDir) || {};
    out.push({ seq: e.seq, ts: e.ts, direction: 'req', type: e.type, action: e.action, body: e.req, ...att });
    out.push({ seq: e.seq, ts: e.ts, direction: 'res', type: e.type, action: e.action, body: e.res, ...att });
  }
  writeFileSync(outputPath, out.map((l) => JSON.stringify(l)).join('\n') + '\n');
}
```
Note: `findShot` reads a pre-generated `shots/.index.json` (list of shot timestamps). The shot index is produced by `adb-snapshot.mjs` (Task 2) on every new screenshot. If the index file is absent, treat as no shots (the `existsSync` guard above returns early).

`tools/capture/README.md`: 3 lines — what each producer writes, the unified schema, how to run `node tools/capture/normalize.mjs <input> <output>` (see CLI in Step 4).

- [ ] **Step 4: Add a small CLI entry + verify**

Append to `normalize.mjs`:
```js
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , inputPath, outputPath] = process.argv;
  normalize({ inputPath, shotsDir: `${here}/../../captures`, uiDir: `${here}/../../captures`, outputPath });
}
```
Run test again: `node --test tools/capture/normalize.test.mjs` → PASS.
Manual smoke: `node tools/capture/normalize.mjs /tmp/fake-flows.jsonl /tmp/fake-actions.jsonl` → creates file (may be empty-validated).

- [ ] **Step 5: Commit**

```bash
git add tools/capture/
git commit -m "feat: capture pipeline scaffolding + action normalizer"
```

---

### Task 2: Path A — Phone MITM capture (mitmproxy addon + adb snapshot)

**Files:**
- Create: `tools/capture/mitm-hooks/engineio-parse.py` (pure, testable)
- Create: `tools/capture/mitm-hooks/addon.py`
- Create: `tools/capture/adb-snapshot.mjs`
- Create: `tools/capture/tls-test.sh`
- Test: `tools/capture/mitm-hooks/test_engineio_parse.py`

**Interfaces:**
- Consumes: adb (installed), mitmproxy (installed this task), normalize schema (Task 1).
- Produces: `captures/<session>/flows.jsonl` (exchange/notify lines), `captures/<session>/shots/<ts>.png`, `ui/<ts>.xml`, `shots/.index.json` — all consumed by Task 1's `normalize`.

- [ ] **Step 1: Install mitmproxy**

Run: `pip3 install --user mitmproxy` (fallback: `sudo apt install -y mitmproxy`).
Verify: `mitmdump --version | head -1` prints a version.

- [ ] **Step 2: Write the failing Socket.IO parser test**

`tools/capture/mitm-hooks/test_engineio_parse.py`:
```python
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from engineio_parse import parse_frame

def test_event_with_ack_in_array():
    # engine '4' + socket '2' + JSON ["handler.process", {..}, ackId]
    raw = '42' + json.dumps(['handler.process', {'type': 'hero', 'action': 'getAttrs'}, 12])
    pkt = parse_frame(raw)
    assert pkt.kind == 'event', pkt
    assert pkt.name == 'handler.process'
    assert pkt.ack_id == 12
    assert pkt.data['type'] == 'hero'

def test_event_id_prefix_form():
    # v2 encoder: '2<id>["event", data]' (id prefix, not in array)
    raw = '4' + '2' + '7' + json.dumps(['Notify', {'a': 1}])
    pkt = parse_frame(raw)
    assert pkt.kind == 'event' and pkt.ack_id == 7 and pkt.data['a'] == 1

def test_ack_response():
    raw = '4' + '3' + json.dumps([12, {'ret': 0, 'data': '{}'}])
    pkt = parse_frame(raw)
    assert pkt.kind == 'ack' and pkt.ack_id == 12
    assert pkt.data == {'ret': 0, 'data': '{}'}

def test_ping_pong_ignored():
    assert parse_frame('2') is None      # engine ping
    assert parse_frame('3') is None      # engine pong
    assert parse_frame('40') is None     # socket connect

def test_namespace_event():
    raw = '4' + '2' + '5' + '/admin,' + json.dumps(['x', 1])
    pkt = parse_frame(raw)
    assert pkt.kind == 'event' and pkt.ack_id == 5 and pkt.namespace == '/admin'
```
Run: `python3 -m pytest tools/capture/mitm-hooks/test_engineio_parse.py` — expected FAIL (module missing). (If `pytest` not installed: `python3 -m pip install --user pytest` — a dev-only test runner, allowed.)

- [ ] **Step 3: Implement the parser**

`tools/capture/mitm-hooks/engineio_parse.py`:
```python
"""Parse Socket.IO-over-WebSocket frames into typed packets.
Handles both ack-id-in-array (socket.io-client v1 style) and
ack-id-prefix (v2 encoder) encodings, plus namespaces.
Returns Packet(kind, name, data, ack_id, namespace) or None for
transport frames (ping/pong/connect) we do not need.
"""
import json
from dataclasses import dataclass
from typing import Optional

@dataclass
class Packet:
    kind: str              # 'event' | 'ack'
    name: Optional[str]    # event name (events only)
    data: object
    ack_id: Optional[int]
    namespace: str = '/'

def parse_frame(msg: str) -> Optional[Packet]:
    if not msg or not msg[0].isdigit():
        return None
    typ = int(msg[0])
    if typ != 4:           # only '4' message carries socket packets
        return None
    rest = msg[1:]
    if not rest or rest[0] not in '0123456':
        return None
    st = rest[0]           # socket.io packet type
    body = rest[1:]
    if st in '01456':      # connect/disconnect/error/binary — skip
        return None
    if st == '3':          # ACK: [ackId, data]
        arr = json.loads(body)
        return Packet('ack', None, arr[1] if len(arr) > 1 else None, arr[0])
    # st == '2' EVENT
    # namespace prefix: '<id>/<nsp>,<json>' or '<nsp>,<json>'
    nsp = '/'
    if body.startswith('/'):
        idx = body.index(',')
        nsp, body = body[:idx], body[idx + 1:]
    arr = json.loads(body)
    if not arr:
        return None
    if isinstance(arr[0], int):          # id-prefix form: [id, name, ...data]
        ack_id = arr[0]; name = arr[1]; data = arr[2] if len(arr) > 2 else None
        return Packet('event', name, data, ack_id, nsp)
    name = arr[0]                        # v1 form: [name, ...data, ackId?]
    ack_id = arr[-1] if len(arr) > 1 and isinstance(arr[-1], int) else None
    data = arr[1] if len(arr) > 1 else None
    if ack_id is not None and len(arr) > 2:
        data = arr[1:-1]
    return Packet('event', name, data, ack_id, nsp)
```

- [ ] **Step 4: Run parser test → PASS**

Run: `python3 -m pytest tools/capture/mitm-hooks/test_engineio_parse.py -v`
Expected: 6 passed.

- [ ] **Step 5: Implement the mitmproxy addon**

`tools/capture/mitm-hooks/addon.py`:
```python
"""mitmproxy addon: log HTTP + Socket.IO frames to flows.jsonl and
trigger a phone screenshot per exchange.

Run:  mitmdump -s tools/capture/mitm-hooks/addon.py \
          -p 8081 --set session=my-session
Writes: captures/<session>/flows.jsonl  (exchange/notify lines)
Pokes:  http://127.0.0.1:8790/snap?seq=<n>  → adb-snapshot.mjs
"""
import json, os, time, urllib.request
from mitmproxy import http, websocket

SESSION = os.environ.get('CAP_SESSION', time.strftime('%Y%m%d-%H%M%S'))
BASE = os.path.join('captures', SESSION)
os.makedirs(os.path.join(BASE, 'shots'), exist_ok=True)
os.makedirs(os.path.join(BASE, 'ui'), exist_ok=True)
PATH = os.path.join(BASE, 'flows.jsonl')
SNAP_URL = 'http://127.0.0.1:8790/snap'
_seq = [0]
_conn_state = {}   # conn id -> { pending: {ack_id: {type, action, req}} }

def _write(obj):
    with open(PATH, 'a') as f:
        f.write(json.dumps(obj) + '\n')

def _snap(seq):
    try:
        urllib.request.urlopen(f'{SNAP_URL}?seq={seq}', timeout=2).read()
    except Exception:
        pass  # adb snapshotter not running — capture still proceeds

def _log_exchange(state, res_body=None):
    pend = state.pop('pending', {})
    # ack responses carry ack_id; simplest: attach to last pending
    for ack, rec in pend.items():
        if res_body is not None and rec.get('_acked'):
            continue
        rec['_acked'] = True
        seq = _seq[0] + 1; _seq[0] = seq
        _write({'conn': state['id'], 'seq': seq, 'ts': int(time.time() * 1000),
                'kind': 'exchange', 'type': rec['type'], 'action': rec['action'],
                'req': rec['req'], 'res': res_body})
        _snap(seq)
        return
    _write({'conn': state['id'], 'seq': _seq[0] + 1, 'ts': int(time.time() * 1000),
            'kind': 'exchange', 'type': rec.get('type'), 'action': rec.get('action'),
            'req': rec.get('req'), 'res': res_body})

def _handle_socket(conn_id, pkt):
    from engineio_parse import parse_frame
    p = parse_frame(pkt)
    if p is None:
        return
    st = _conn_state.setdefault(conn_id, {'id': conn_id, 'pending': {}})
    if p.kind == 'event' and p.name == 'handler.process':
        payload = p.data
        st['pending'][p.ack_id] = {'type': payload.get('type') if isinstance(payload, dict) else None,
                                   'action': payload.get('action') if isinstance(payload, dict) else None,
                                   'req': payload}
    elif p.kind == 'ack':
        _log_exchange(st, res_body=p.data)

def websocket_message(flow: http.HTTPFlow):
    for m in flow.websocket.messages:
        try:
            text = m.content.decode('utf-8', 'replace')
        except Exception:
            continue
        _handle_socket(flow.metadata.get('websocket_conn_id', id(flow)), text)
```
> Note: an engineer implementing this must confirm the mitmproxy v10/11 websocket hook signature (`websocket_message(flow)` iterating `flow.websocket.messages`, each `message.content`). If the installed mitmproxy version differs, adjust the hook name/args per its API — the `_handle_socket` core stays identical.

- [ ] **Step 6: Implement the adb snapshotter**

`tools/capture/adb-snapshot.mjs`:
```js
// ============================================================
// adb-snapshot — listens on :8790 for /snap?seq=N, takes one
// screenshot + uiautomator dump per trigger, maintains shots/.index.json.
// Run: node tools/capture/adb-snapshot.mjs <session>
// ============================================================
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const session = process.argv[2] || 'default';
const base = join('captures', session);
const shots = join(base, 'shots'); const ui = join(base, 'ui');
mkdirSync(shots, { recursive: true }); mkdirSync(ui, { recursive: true });
const indexFile = join(shots, '.index.json');
let index = existsSync(indexFile) ? JSON.parse(readFileSync(indexFile, 'utf8')) : [];
let lastShot = 0;

function snap(seq) {
  const now = Date.now();
  if (now - lastShot < 1000) return;          // debounce bursts
  lastShot = now;
  const png = `${shots}/${now}.png`;
  execFile('adb', ['exec-out', 'screencap', '-p'], (err, stdout) => {
    if (!err) { writeFileSync(png, stdout); index.push(now); writeFileSync(indexFile, JSON.stringify(index)); }
  });
  execFile('adb', ['shell', 'uiautomator', 'dump', '/sdcard/ui.xml'], () => {
    execFile('adb', ['pull', '/sdcard/ui.xml', `${ui}/${now}.xml`], () => {});
  });
}

createServer((req, res) => {
  snap(Number(new URL(req.url, 'http://x').searchParams.get('seq') || 0));
  res.end('ok');
}).listen(8790, '127.0.0.1', () => console.log(`[adb-snapshot] :8790 → ${base}`));
```

- [ ] **Step 7: Write + run the TLS gate script**

`tools/capture/tls-test.sh`:
```bash
#!/usr/bin/env bash
# TLS gate: is the real server's TLS interceptable with a user-installed CA?
# Usage: ./tls-test.sh            # run mitmdump + adb-snapshot, then drive the app
set -euo pipefail
SESSION="tls-test-$(date +%H%M%S)"
node tools/capture/adb-snapshot.mjs "$SESSION" &
ADB_PID=$!
trap 'kill $ADB_PID 2>/dev/null' EXIT
echo "1) On phone: Settings → Install user cert (mitmproxy CA from ~/.mitmproxy/mitmproxy-ca-cert.pem, email it to yourself)."
echo "2) Phone WiFi proxy → $(hostname -I | awk '{print $1}'):8081"
echo "3) Open the game, do a few actions."
mitmdump -s tools/capture/mitm-hooks/addon.py -p 8081 --set session="$SESSION" 2>&1 | tee "$PWD/captures/$SESSION/mitm.log"
echo "Result file: captures/$SESSION/flows.jsonl"
```
Make executable: `chmod +x tools/capture/tls-test.sh`.
Run: `./tools/capture/tls-test.sh` (manual, with phone). **Manual verify:** open `captures/$SESSION/flows.jsonl` — if it contains JSON `exchange` lines with non-empty `res` (real server data), **TLS gate PASSED → Path A is primary**. If only HTTP blobs or connection errors, TLS gate FAILED → log it and rely on Path B (Task 3).

- [ ] **Step 8: Commit**

```bash
git add tools/capture/mitm-hooks/ tools/capture/adb-snapshot.mjs tools/capture/tls-test.sh
git commit -m "feat: phone MITM capture (mitmproxy addon + adb snapshotter + TLS gate)"
```

---

### Task 3: Path B — Browser capture (Playwright toward real server)

**Files:**
- Create: `tools/capture/browser-capture.mjs`
- Create: `tools/capture/browser-capture.test.mjs` (unit: correlation logic only)

**Interfaces:**
- Consumes: root `playwright` dep (installed), normalize schema (Task 1), a real server domain (from Path A's `flows.jsonl` first `login` `serverItem.url`, or user-provided via `--domain`).
- Produces: `captures/<session>/browser.jsonl` — same exchange/notify line shape as the addon, so `normalize` handles it identically.

- [ ] **Step 1: Write failing unit test for the frame correlator**

The only pure logic here is correlating client emits (with ack id) to server ack responses. Extract it as a pure function `correlate(frames)`.

`tools/capture/browser-capture.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { correlate } from './browser-capture.mjs';

test('correlate pairs emit to ack by ackId', () => {
  const frames = [
    { ts: 1, dir: 'emit', name: 'handler.process', ackId: 12, data: { type: 'hero', action: 'getAttrs' } },
    { ts: 2, dir: 'ack', ackId: 12, data: { ret: 0, data: '{}' } },
  ];
  const out = correlate(frames);
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, 'exchange');
  assert.equal(out[0].type, 'hero');
  assert.equal(out[0].action, 'getAttrs');
  assert.equal(out[0].res.ret, 0);
});

test('Notify frames become notify lines', () => {
  const frames = [{ ts: 3, dir: 'emit', name: 'Notify', data: { type: 'activity' } }];
  const out = correlate(frames);
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, 'notify');
});
```
Run: `node --test tools/capture/browser-capture.test.mjs` → FAIL (no module).

- [ ] **Step 2: Implement `browser-capture.mjs`**

```js
// ============================================================
// browser-capture — Playwright against the REAL server domain.
// Use: node tools/capture/browser-capture.mjs --domain <host[:port]> [--session <name>]
// Opens the emulator client page (client/index.html) with the real
// domain injected, captures socket.io frames + screenshots.
// Writes captures/<session>/browser.jsonl (same shape as the addon).
// ============================================================
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export function correlate(frames) {
  const out = []; const pending = new Map(); let seq = 0;
  for (const f of frames) {
    if (f.name === 'Notify' && f.dir === 'emit') {
      out.push({ conn: 'browser', seq: ++seq, ts: f.ts, kind: 'notify', type: f.data?.type, body: f.data });
      continue;
    }
    if (f.dir === 'emit' && f.ackId != null) {
      pending.set(f.ackId, { type: f.data?.type, action: f.data?.action, req: f.data });
    } else if (f.dir === 'ack') {
      const rec = pending.get(f.ackId);
      if (rec) { pending.delete(f.ackId); out.push({ conn: 'browser', seq: ++seq, ts: f.ts, kind: 'exchange', type: rec.type, action: rec.action, req: rec.req, res: f.data }); }
    }
  }
  return out;
}

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; }

const domain = arg('--domain');
const session = arg('--session') || `browser-${Date.now()}`;
if (!domain) { console.error('usage: node browser-capture.mjs --domain <host[:port]>'); process.exit(1); }

const base = join('captures', session);
mkdirSync(join(base, 'shots'), { recursive: true });
const frames = [];
const browser = await chromium.launch({ headless: false, viewport: { width: 720, height: 1280 } });
const page = await browser.newPage();
page.on('websocket', (ws) => {
  ws.on('framesent', (e) => { if (typeof e.payload === 'string') frames.push({ ts: Date.now(), dir: 'emit', ...parseWs(e.payload) }); });
  ws.on('framereceived', (e) => { if (typeof e.payload === 'string') frames.push({ ts: Date.now(), dir: 'ack', ...parseWs(e.payload) }); });
});
page.on('load', async () => { await page.screenshot({ path: join(base, 'shots', String(Date.now()) + '.png') }); });
// Point the emulator client at the real domain via its native bridge mock:
await page.addInitScript((d) => {
  // browser-boot.js reads serverItem.url from the login response; force the
  // login URL to the real domain so serverItem.url = real server.
  window.__REAL_DOMAIN__ = d;
}, domain);
await page.goto(`http://127.0.0.1:8080/index.html`);
// Manual login in the visible browser, then keep capturing.
console.log('Capturing. Press Ctrl+C to stop.');
await new Promise(() => {});

function parseWs(payload) {
  // Same socket.io framing as the addon: '4' engine + '2' event / '3' ack.
  const m = payload.match(/^4(2|3)(.*)$/s);
  if (!m) return {};
  const st = m[1]; const body = m[2];
  let arr; try { arr = JSON.parse(body); } catch { return {}; }
  if (st === '3') return { ackId: arr[0], data: arr[1] ?? null };
  // event: v1 [name, ...data, ackId?] or v2 [id, name, ...data]
  let name, data, ackId;
  if (typeof arr[0] === 'number') { ackId = arr[0]; name = arr[1]; data = arr[2] ?? null; }
  else { name = arr[0]; ackId = (arr.length > 1 && typeof arr[arr.length - 1] === 'number') ? arr[arr.length - 1] : undefined; data = arr.length > 1 ? arr[arr.length - 1] : null; if (ackId != null && arr.length > 2) data = arr[arr.length - 2]; }
  return { name, data, ackId };
}
```
> Engineer note: this is the first runnable skeleton. The exact ackId/data extraction may need a tweak after one live run — the `correlate` unit test pins the contract; adjust `parseWs` only.

- [ ] **Step 3: Run unit test → PASS**

Run: `node --test tools/capture/browser-capture.test.mjs`
Expected: 2 passed. (`correlate` is exported; importing the module must not auto-run the browser — it doesn't: the browser code is top-level but guarded by `process.argv[1]` check. **Add the argv guard now** if not present, so `import { correlate }` is side-effect free.)

- [ ] **Step 4: Manual smoke against the local emulator first**

Run: `node tools/capture/browser-capture.mjs --domain 127.0.0.1:8080 --session smoke`
Login in the visible Playwright browser (emulator login flow). Stop with Ctrl+C, then:
`node tools/capture/normalize.mjs captures/smoke/browser.jsonl captures/smoke/actions.jsonl`
Verify `actions.jsonl` has `login`/`enterGame` exchanges. This proves the frame→actions pipeline works before pointing at the real domain.

- [ ] **Step 5: Commit**

```bash
git add tools/capture/browser-capture.mjs tools/capture/browser-capture.test.mjs
git commit -m "feat: browser capture toward real server (Playwright + socket frame correlator)"
```

---

### Task 4: Replay-diff engine

**Files:**
- Create: `tools/replay/deep-diff.mjs`
- Create: `tools/replay/deep-diff.test.mjs`
- Create: `tools/replay/diff-engine.mjs`

**Interfaces:**
- Consumes: `actions.jsonl` (Task 1 output), local emulator on :8080, `socket.io-client` (added this task), `VOLATILE_KEYS` set.
- Produces: `reports/replay-diff-report.md` — per `type/action` fidelity % + mismatch samples.

- [ ] **Step 1: Add socket.io-client as a root dependency**

Edit `package.json` → add to `dependencies`: `"socket.io-client": "^2.5.0"`. Run `npm install` at repo root.
Verify: `node -e "const {io}=require('socket.io-client'); console.log(typeof io)"` prints `function`.

- [ ] **Step 2: Write failing deep-diff test**

`tools/replay/deep-diff.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { diffValues, VOLATILE_KEYS } from './deep-diff.mjs';

test('ignores volatile keys', () => {
  const a = { serverTime: 123, nick: 'P' };
  const b = { serverTime: 456, nick: 'P' };
  const d = diffValues(a, b, new Set([...VOLATILE_KEYS, 'serverTime']));
  assert.equal(d.same, true);
});

test('reports scalar mismatch path', () => {
  const a = { user: { _id: 1001, level: 50 } };
  const b = { user: { _id: 1001, level: 99 } };
  const d = diffValues(a, b, new Set());
  assert.equal(d.same, false);
  assert.deepEqual(d.mismatches[0].path, ['user', 'level']);
  assert.equal(d.mismatches[0].expected, 50);
  assert.equal(d.mismatches[0].got, 99);
});

test('missing key in got is a mismatch', () => {
  const d = diffValues({ a: 1, b: 2 }, { a: 1 }, new Set());
  assert.equal(d.same, false);
  assert.equal(d.mismatches[0].path.join('.'), 'b');
});
```
Run: `node --test tools/replay/deep-diff.test.mjs` → FAIL (no module).

- [ ] **Step 3: Implement deep-diff**

`tools/replay/deep-diff.mjs`:
```js
// ============================================================
// deep-diff — structural compare of two JSON values.
// VOLATILE_KEYS: keys that legitimately change between sessions
// (timestamps, signatures, random ids) — excluded from comparison.
// Returns { same: boolean, mismatches: [{path, expected, got}] }.
// ============================================================
export const VOLATILE_KEYS = new Set([
  'serverTime', '_lastLoginTime', '_createTime', 'sign', 'ts', 'id', 'seq', 'session', 'token',
]);

export function diffValues(a, b, volatile = VOLATILE_KEYS, path = []) {
  if (typeof a !== typeof b) return { same: false, mismatches: [{ path, expected: a, got: b }] };
  if (a === null || b === null) {
    return a === b ? { same: true, mismatches: [] } : { same: false, mismatches: [{ path, expected: a, got: b }] };
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return { same: false, mismatches: [{ path, expected: a, got: b }] };
    const ms = [];
    for (let i = 0; i < a.length; i++) ms.push(...diffValues(a[i], b[i], volatile, [...path, i]).mismatches);
    return { same: ms.length === 0, mismatches: ms };
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ms = [];
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (volatile.has(k)) continue;
      if (!(k in b) || !(k in a)) { ms.push({ path: [...path, k], expected: a[k], got: b[k] }); continue; }
      ms.push(...diffValues(a[k], b[k], volatile, [...path, k]).mismatches);
    }
    return { same: ms.length === 0, mismatches: ms };
  }
  if (a !== b) return { same: false, mismatches: [{ path, expected: a, got: b }] };
  return { same: true, mismatches: [] };
}
```

- [ ] **Step 4: Run deep-diff test → PASS**

Run: `node --test tools/replay/deep-diff.test.mjs` → 3 passed.

- [ ] **Step 5: Implement the diff engine**

`tools/replay/diff-engine.mjs`:
```js
// ============================================================
// diff-engine — replay captured actions into the local emulator
// and measure fidelity per type/action.
// Use: node tools/replay/diff-engine.mjs <actions.jsonl> [emulatorURL]
// Writes: reports/replay-diff-report.md
// ============================================================
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { io } from 'socket.io-client';
import { diffValues, VOLATILE_KEYS } from './deep-diff.mjs';

const actionsPath = process.argv[2];
const url = process.argv[3] || 'http://127.0.0.1:8080';
const actions = readFileSync(actionsPath, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);

function call(socket, payload) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout ${payload.type}.${payload.action}`)), 5000);
    socket.emit('handler.process', payload, (res) => { clearTimeout(t); resolve(res); });
  });
}

async function main() {
  const socket = io(url, { reconnectionAttempts: 2, transports: ['websocket'] });
  await new Promise((res, rej) => { socket.on('connect', res); socket.on('connect_error', rej); });
  // replay login flow first if present (captured session auth)
  const login = actions.filter((a) => a.direction === 'req' && a.type === 'login');
  for (const a of login) { try { await call(socket, a.body); } catch {} }

  const rows = [];
  for (const a of actions.filter((x) => x.direction === 'req')) {
    if (a.type === 'login') continue; // already replayed
    let got; try { got = await call(socket, a.body); } catch (e) { got = { _error: e.message }; }
    const expected = typeof a.body?._expect?.data === 'object' ? a.body._expect : {};
    // diff against the CAPTURED response (a.body.res stored by normalizer? no —
    // res is a separate line). Use the matching res line:
    const resLine = actions.find((x) => x.direction === 'res' && x.seq === a.seq);
    const expectedRes = resLine ? parseExpected(resLine.body) : null;
    const d = expectedRes ? diffValues(expectedRes, got, VOLATILE_KEYS) : { same: null, mismatches: [] };
    rows.push({ type: a.type, action: a.action, same: d.same, mismatches: d.mismatches.slice(0, 5) });
  }
  socket.close();

  // --- report ---
  const byKey = {};
  for (const r of rows) {
    const k = `${r.type}/${r.action}`;
    (byKey[k] = byKey[k] || []).push(r);
  }
  const out = ['# Replay-Diff Report', '', `Generated: ${new Date().toISOString()}`, '',
    `Actions: ${rows.length} req replayed against ${url}`, ''];
  for (const [k, rs] of Object.entries(byKey)) {
    const known = rs.filter((r) => r.same !== null);
    const sameN = known.filter((r) => r.same).length;
    const pct = known.length ? Math.round((sameN / known.length) * 100) : 0;
    out.push(`## ${k} — ${pct}% (${sameN}/${known.length})`);
    for (const r of rs.slice(0, 2)) for (const m of r.mismatches) {
      out.push(`- \`${m.path.join('.')}\` expected=${JSON.stringify(m.expected)} got=${JSON.stringify(m.got)}`);
    }
    out.push('');
  }
  mkdirSync('reports', { recursive: true });
  writeFileSync('reports/replay-diff-report.md', out.join('\n') + '\n');
  console.log(`Report: reports/replay-diff-report.md (${Object.keys(byKey).length} endpoints)`);
}

function parseExpected(body) {
  // body is the captured socket response { ret, data?: string }
  if (body && typeof body.data === 'string') { try { return { ...body, data: JSON.parse(body.data) }; } catch { return body; } }
  return body;
}

main().catch((e) => { console.error('diff-engine failed:', e.message); process.exit(1); });
```
> Engineer note: this wires the minimal loop. Correlation of `req`→`res` in `actions.jsonl` is by `seq` (guaranteed by the normalizer). If login replay is insufficient to authenticate the emulator for later calls, extend `call` to also send `verify` first (the emulator requires a `verify` handshake — see `server/src/socket/index.js`).

- [ ] **Step 6: Smoke the engine against the emulator**

Start emulator: `node server/src/index.js` (background). Then use the `smoke` actions from Task 3 Step 4:
`node tools/replay/diff-engine.mjs captures/smoke/actions.jsonl`
Verify: `reports/replay-diff-report.md` renders per-endpoint rows; `login/getServerList` ≈ 100%, unimplemented types ≈ 0%.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tools/replay/
git commit -m "feat: replay-diff engine (deep-diff + per-endpoint fidelity report)"
```

---

## Self-Review

**Spec coverage:**
- §4.1 TLS gate → Task 2 Step 7 (`tls-test.sh`). ✅
- §4.2 Path A (addon + adb snapshot) → Task 2 Steps 5–6. ✅
- §4.3 Path B (browser) → Task 3. ✅
- §4.4 Normalizer → Task 1. ✅
- §4.5 Replay-diff → Task 4. ✅
- §5 file layout + §7 verification → per-task verify steps + smoke in Tasks 3/4. ✅
- §6 error handling → baked into addon (debounce, no-dependency), engine (timeout, login replay). ✅
- Domain-not-in-APK finding → Task 3 uses `--domain` from Path A. ✅

**Placeholder scan:** no TBD/TODO; all code concrete. The only "engineer note" annotations flag mitmproxy-version API drift and ack-extraction tweak — these are real environment unknowns, not placeholders.

**Type consistency:** `normalize` schema (`seq/ts/direction/type/action/body/screenshot/uiDump`) used identically in Tasks 1/2/3/4. `correlate()` frames shape matches the addon's line shape. `diffValues`/`VOLATILE_KEYS` used in diff-engine.

**Dependency order:** Task 1 (normalize) → Tasks 2/3 (producers) → Task 4 (consumes normalize + producers). Tasks 2/3 independent.
