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
