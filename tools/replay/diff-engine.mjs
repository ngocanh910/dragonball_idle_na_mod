// ============================================================
// diff-engine — replay captured actions into the local emulator
// and measure fidelity per type/action.
// Use: node tools/replay/diff-engine.mjs <actions.jsonl> [emulatorURL]
// Writes: reports/replay-diff-report.md
// ============================================================
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import io from 'socket.io-client';
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

// The emulator emits a 'verify' challenge on connect and only ack's
// handler.process once the client answers socket.on('verify').
function verify(socket) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('verify handshake timeout')), 5000);
    socket.once('verify', (challenge) => {
      socket.emit('verify', { challenge }, (res) => { clearTimeout(t); resolve(res); });
    });
    socket.once('connect_error', (e) => { clearTimeout(t); reject(e); });
  });
}

// NOTE(diff-engine): strict diff — every key not present in the captured
// response (extra volatile keys beyond the VOLATILE_KEYS set) counts as a
// mismatch. We only compare the response body; top-level frame fields
// (seq, ts, direction, type, action, body) and the req payload are not
// part of the response shape.
// lastLoginTime: emulator enterGame emits `lastLoginTime: now` (session
// timestamp, enter-game-state.js:204) — legitimately differs per session.
const VOCAB = new Set(VOLATILE_KEYS);
VOCAB.delete('seq');
VOCAB.delete('ts');
VOCAB.delete('direction');
VOCAB.delete('type');
VOCAB.delete('action');
VOCAB.delete('body');
VOCAB.add('lastLoginTime');

async function main() {
  const socket = io(url, { reconnectionAttempts: 2, transports: ['websocket'] });
  // The server emits 'verify' immediately on connect — attach the listener
  // BEFORE awaiting connect, or the event is missed.
  const ackP = verify(socket);
  await new Promise((res, rej) => { socket.on('connect', res); socket.on('connect_error', rej); });
  await ackP;
  // replay login flow first if present (captured session auth)
  const login = actions.filter((a) => a.direction === 'req' && a.type === 'login');
  for (const a of login) { try { await call(socket, a.body); } catch {} }

  const rows = [];
  for (const a of actions.filter((x) => x.direction === 'req')) {
    if (a.type === 'login') continue; // already replayed
    let got; try { got = await call(socket, a.body); } catch (e) { got = { _error: e.message }; }
    // diff against the CAPTURED response (the matching res line, same seq):
    const resLine = actions.find((x) => x.direction === 'res' && x.seq === a.seq);
    const expectedRes = resLine ? parseExpected(resLine.body) : null;
    const gotRes = expectedRes ? parseExpected(got) : null;
    const d = expectedRes && gotRes ? diffValues(expectedRes, gotRes, VOCAB) : { same: null, mismatches: [] };
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
