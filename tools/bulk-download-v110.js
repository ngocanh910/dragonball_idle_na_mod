// ============================================================
// Bulk-download the v110 asset set from the live CDN, driven by
// the device's own manifest (real-art/resource/default.res.json).
//
// Uses the DEVICE manifest (version 110) as the authoritative list
// so the downloaded art matches the app the user actually runs —
// not the CDN's newer manifest. Each file's logical path is taken
// from the manifest url (query stripped); content is fetched from
// the CDN at that path (the CDN serves the same file regardless of
// the ?v= cache-buster, verified).
//
// Resumable (skips files already on disk), concurrent, logs misses.
//   node tools/bulk-download-v110.js
// ============================================================

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'real-art', 'resource', 'default.res.json');
const OUT_DIR = path.join(ROOT, 'real-art', 'resource');
const CDN_BASE = process.env.CDN_BASE || 'https://dragonh5cdn.popoh5.com/bs/resource';
const CONCURRENCY = parseInt(process.env.CONCURRENCY, 10) || 24;
const TIMEOUT_MS = 20000;
const LOG_MISS = path.join(ROOT, 'tools', 'v110-missing.log');

function loadUrls() {
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const res = m.resources || m.resource || [];
  // De-dup by logical path (query stripped)
  const seen = new Map();
  for (const r of res) {
    if (!r.url) continue;
    const rel = r.url.split('?')[0];
    if (!seen.has(rel)) seen.set(rel, r.url); // keep first (with ?v=)
  }
  return [...seen.entries()].map(([rel, url]) => ({ rel, url }));
}

async function fetchOne(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(`${CDN_BASE}/${url}`, { signal: ctrl.signal });
    if (!r.ok) return { status: r.status };
    const buf = Buffer.from(await r.arrayBuffer());
    return { status: 200, buf };
  } catch (e) {
    return { status: 'ERR', err: e.message };
  } finally {
    clearTimeout(t);
  }
}

(async () => {
  const items = loadUrls();
  console.log(`Manifest: ${items.length} unique assets. CDN: ${CDN_BASE}`);
  console.log(`Output: ${OUT_DIR}  concurrency=${CONCURRENCY}\n`);

  let done = 0, skipped = 0, ok = 0, miss = 0, bytes = 0;
  const misses = [];
  const t0 = Date.now();

  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      const { rel, url } = items[i];
      const dest = path.join(OUT_DIR, rel);
      done++;
      if (fs.existsSync(dest) && fs.statSync(dest).size > 0) { skipped++; continue; }
      const r = await fetchOne(url);
      if (r.status === 200 && r.buf) {
        try {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(dest, r.buf);
          ok++; bytes += r.buf.length;
        } catch (e) {
          // path collides with an existing file (e.g. "properties") — skip
          miss++; misses.push(`WRITE:${e.code}\t${url}`);
        }
      } else {
        miss++; misses.push(`${r.status}\t${url}`);
      }
      if (done % 200 === 0) {
        const pct = ((done / items.length) * 100).toFixed(1);
        const mb = (bytes / 1048576).toFixed(0);
        console.log(`  ${done}/${items.length} (${pct}%)  ok=${ok} skip=${skipped} miss=${miss}  ${mb}MB`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  if (misses.length) fs.writeFileSync(LOG_MISS, misses.join('\n'));
  const secs = ((Date.now() - t0) / 1000).toFixed(0);
  console.log(`\nDONE in ${secs}s`);
  console.log(`  downloaded: ${ok}   skipped(existing): ${skipped}   missing: ${miss}`);
  console.log(`  new bytes: ${(bytes / 1048576).toFixed(1)} MB`);
  if (miss) console.log(`  missing list -> ${LOG_MISS}`);
})();
