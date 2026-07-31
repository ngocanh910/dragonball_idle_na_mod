// ============================================================
// browser-capture — Playwright against the REAL server domain.
// Use: node tools/capture/browser-capture.mjs --domain <host[:port]> [--session <name>] [--auto-login]
// Opens the emulator client page (client/index.html), captures socket.io
// frames + screenshots. --auto-login drives handler.process login/enterGame
// through the page's io global (the game only connects after manual UI login,
// which can't be done headless).
// Writes captures/<session>/browser.jsonl (same shape as the addon).
// ============================================================
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function correlate(frames) {
  const out = []; const pending = new Map(); let seq = 0;
  for (const f of frames) {
    if (f.name === 'Notify') {
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

function parseWs(payload) {
  // Same socket.io framing as the addon: '4' engine + '2' event / '3' ack.
  const m = payload.match(/^4(2|3)(.*)$/s);
  if (!m) return {};
  const st = m[1]; let body = m[2];
  // socket.io v2 puts the ack id OUTSIDE the JSON as a digit prefix,
  // e.g. '430[{...}]' (ack), '420["handler.process",{...}]' (event).
  let ackId;
  const prefix = body.match(/^(\d+)/);
  if (prefix) { ackId = Number(prefix[1]); body = body.slice(prefix[1].length); }
  let arr; try { arr = JSON.parse(body); } catch { return {}; }
  if (st === '3') {
    // in-array id form '43[12,{...}]' (brief's original assumption)
    if (ackId == null && typeof arr[0] === 'number') { ackId = arr[0]; arr = arr.slice(1); }
    return { ackId, data: arr[0] ?? null };
  }
  // event: [name, ...data], [name, ...data, ackId], or [id, name, ...data]
  if (ackId == null && typeof arr[0] === 'number' && typeof arr[1] === 'string') {
    ackId = arr[0]; arr = arr.slice(1);
  }
  const name = arr[0];
  const tail = arr[arr.length - 1];
  let data;
  if (typeof tail === 'number' && arr.length > 1) {
    if (ackId == null) ackId = tail;
    data = arr.length > 2 ? arr[arr.length - 2] : null;
  } else {
    data = arr.length > 1 ? tail : null;
  }
  return { name, data, ackId };
}

function arg(name) { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null; }

// Guard: importing for tests must be side-effect free.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const domain = arg('--domain');
  const session = arg('--session') || `browser-${Date.now()}`;
  if (!domain) { console.error('usage: node browser-capture.mjs --domain <host[:port]> [--session <name>]'); process.exit(1); }

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
  if (process.argv.includes('--auto-login')) {
    // Drive the game's own socket.io protocol via the page's loaded `io`
    // global (the game only connects after manual UI login, which can't be
    // done headless). Same handler.process/ack shape the game uses.
    console.log('Auto-login: emitting handler.process login/enterGame via page io global.');
    await page.evaluate(async (dom) => {
      const ioGlobal = await new Promise((resolve, reject) => {
        const timer = setInterval(() => {
          if (typeof io !== 'undefined') { clearInterval(timer); resolve(io); }
          else if (typeof window.__autoLoginDeadline !== 'undefined' && Date.now() > window.__autoLoginDeadline) { clearInterval(timer); reject(new Error('io global not loaded')); }
        }, 500);
        window.__autoLoginDeadline = Date.now() + 20000;
      });
      const sock = ioGlobal(`http://${dom}`, { transports: ['websocket'] });
      await new Promise((resolve) => sock.on('connect', resolve));
      sock.emit('handler.process', { type: 'User', action: 'loginGame', userId: 'browser_user', password: 'game_origin' }, () => {});
      sock.emit('handler.process', { type: 'User', action: 'enterGame', userId: 'browser_user' }, () => {});
    }, domain);
  }
  // Manual login in the visible browser, then keep capturing.
  console.log('Capturing. Press Ctrl+C to stop.');
  await new Promise((resolve) => {
    process.on('SIGINT', () => { console.log('\nStopping, writing browser.jsonl.'); resolve(); });
    process.on('SIGTERM', () => resolve());
  });
  writeFileSync(join(base, 'browser.jsonl'),
    correlate(frames).map((l) => JSON.stringify(l)).join('\n') + '\n');
  await browser.close();
}
