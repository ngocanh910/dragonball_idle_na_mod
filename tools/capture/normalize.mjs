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
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';

const SHOT_WINDOW_MS = 250;

export const ACTION_SCHEMA = {
  seq: 'number (epoch ms)',
  ts: 'number (epoch ms)',
  direction: "'req' | 'res' | 'notify'",
  type: 'string',
  action: 'string (req/res only)',
  body: 'object',
  screenshot: 'string? — shots/<ts>.png',
  uiDump: 'string? — ui/<ts>.xml',
};

export function findShot(ts, shotsDir, uiDir) {
  // exact match first, then nearest within window (earliest shot).
  let best = null; let bestDelta = Infinity;
  if (!existsSync(shotsDir)) return best;
  const idx = `${shotsDir}/.index.json`;
  let times;
  if (existsSync(idx)) {
    times = JSON.parse(readFileSync(idx, 'utf8'));
    if (!Array.isArray(times)) times = null;   // malformed index → fall through
  }
  if (!times) {
    // no index yet (e.g. test fixtures) — derive from shot filenames
    times = readdirSync(shotsDir)
      .filter((f) => f.endsWith('.png'))
      .map((f) => Number(f.slice(0, -4)));
  }
  for (const t of times) {
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

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , inputPath, outputPath] = process.argv;
  const dir = dirname(inputPath);   // producer writes next to its own session dir
  normalize({ inputPath, shotsDir: join(dir, 'shots'), uiDir: join(dir, 'ui'), outputPath });
}
