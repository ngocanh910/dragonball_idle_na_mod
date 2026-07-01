// ============================================================
// Debug Dashboard — Single-file HTML page
// Auto-refreshing logs, stats, error view, and quick-test panel.
// ============================================================

function getDashboardHtml() {
  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Dragon Ball Idle — Debug Dashboard</title>
<style>
  :root {
    --bg:        #0d1117;
    --surface:   #161b22;
    --border:    #30363d;
    --text:      #c9d1d9;
    --text-dim:  #8b949e;
    --accent:    #58a6ff;
    --green:     #3fb950;
    --yellow:    #d29922;
    --red:       #f85149;
    --teal:      #39d2c0;
    --radius:    8px;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
    background: var(--bg); color: var(--text);
    font-size: 13px; line-height: 1.5;
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }

  /* ── Layout ─────────────────────────────────── */
  .container { max-width: 1200px; margin: 0 auto; padding: 16px; }
  h1 { font-size: 18px; color: var(--teal); margin-bottom: 4px; }
  h2 { font-size: 14px; color: var(--text-dim); margin-bottom: 8px; font-weight: 400; }
  h3 { font-size: 13px; color: var(--accent); margin-bottom: 6px; font-weight: 600; }

  /* ── Cards ──────────────────────────────────── */
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 14px 16px; margin-bottom: 12px;
  }
  .card-header {
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 10px;
  }
  .card-header h2 { margin: 0; font-size: 14px; color: var(--accent); font-weight: 600; }

  /* ── Stats Grid ─────────────────────────────── */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px;
  }
  .stat-box {
    background: var(--bg); border: 1px solid var(--border);
    border-radius: 6px; padding: 10px 12px; text-align: center;
  }
  .stat-value {
    font-size: 22px; font-weight: 700; color: var(--teal);
    line-height: 1.2;
  }
  .stat-value.errors { color: var(--red); }
  .stat-label {
    font-size: 11px; color: var(--text-dim); text-transform: uppercase;
    letter-spacing: 0.5px; margin-top: 2px;
  }

  /* ── Status indicator ───────────────────────── */
  .status-row {
    display: flex; gap: 16px; flex-wrap: wrap; align-items: center;
    margin-bottom: 14px;
  }
  .status-dot {
    display: inline-block; width: 10px; height: 10px;
    border-radius: 50%; margin-right: 6px;
  }
  .status-dot.ok    { background: var(--green); box-shadow: 0 0 6px var(--green); }
  .status-dot.error { background: var(--red);   box-shadow: 0 0 6px var(--red); }
  .status-dot.warn  { background: var(--yellow); box-shadow: 0 0 6px var(--yellow); }
  .status-item { color: var(--text-dim); }

  /* ── Log Table ──────────────────────────────── */
  .log-controls {
    display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; align-items: center;
  }
  .log-controls select, .log-controls input {
    background: var(--bg); border: 1px solid var(--border);
    color: var(--text); border-radius: 4px; padding: 4px 8px; font-size: 12px;
    font-family: inherit;
  }
  .log-controls label {
    color: var(--text-dim); font-size: 11px; display: flex; align-items: center; gap: 4px;
  }
  .log-table-wrap { max-height: 480px; overflow-y: auto; }
  table {
    width: 100%; border-collapse: collapse;
  }
  th {
    text-align: left; padding: 6px 8px; font-size: 11px;
    color: var(--text-dim); text-transform: uppercase;
    border-bottom: 1px solid var(--border); position: sticky; top: 0;
    background: var(--surface); letter-spacing: 0.5px;
  }
  td {
    padding: 5px 8px; border-bottom: 1px solid #1c2128;
    white-space: nowrap; max-width: 500px; overflow: hidden;
    text-overflow: ellipsis;
  }
  tr:hover { background: #1c2128; }
  tr.error { background: #2d1215; }
  tr.error:hover { background: #3d1a1e; }
  tr.warn  { background: #2d2510; }
  tr.warn:hover  { background: #3d3318; }

  .level-badge {
    display: inline-block; padding: 1px 6px; border-radius: 3px;
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .level-badge.info  { background: #0d419d33; color: var(--accent); }
  .level-badge.warn  { background: #d2992233; color: var(--yellow); }
  .level-badge.error { background: #f8514933; color: var(--red); }

  .method-badge {
    display: inline-block; padding: 1px 5px; border-radius: 3px;
    font-size: 10px; font-weight: 700;
  }
  .method-badge.GET    { background: #3fb95033; color: var(--green); }
  .method-badge.POST   { background: #58a6ff33; color: var(--accent); }
  .method-badge.ALL    { background: #d2992233; color: var(--yellow); }

  .dur { color: var(--text-dim); }
  .dur.slow { color: var(--yellow); }
  .dur.vslow { color: var(--red); }

  .ts { color: var(--text-dim); font-size: 11px; }
  .path { color: var(--teal); }
  .err-msg { color: var(--red); font-size: 11px; max-width: 400px; overflow: hidden; text-overflow: ellipsis; }

  /* ── Quick Test ─────────────────────────────── */
  .test-grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 8px;
  }
  .test-btn {
    background: var(--bg); border: 1px solid var(--border);
    color: var(--text); padding: 8px 12px; border-radius: 6px;
    cursor: pointer; font-family: inherit; font-size: 12px;
    text-align: left; transition: border-color 0.15s;
  }
  .test-btn:hover { border-color: var(--accent); }
  .test-btn:active { background: var(--border); }
  .test-btn .label { color: var(--accent); font-weight: 600; }
  .test-btn .desc  { color: var(--text-dim); font-size: 11px; }

  .test-result {
    margin-top: 10px; background: var(--bg); border: 1px solid var(--border);
    border-radius: 6px; padding: 10px 12px; max-height: 300px;
    overflow: auto; display: none; white-space: pre-wrap;
    font-size: 12px; line-height: 1.6;
  }
  .test-result.visible { display: block; }
  .test-result.ok { border-color: var(--green); }
  .test-result.fail { border-color: var(--red); }

  /* ── Scrollbar ──────────────────────────────── */
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
</style>
</head>
<body>
<div class="container">

  <!-- Header -->
  <h1>🐉 Dragon Ball Idle — Debug Dashboard</h1>
  <h2>Emulator server real-time monitor</h2>

  <!-- Status row -->
  <div class="status-row" id="status-row">
    <span class="status-item"><span class="status-dot ok" id="dot-server"></span>Server: <strong id="st-uptime">—</strong></span>
    <span class="status-item">Port: <strong id="st-port">—</strong></span>
    <span class="status-item">GameData: <strong id="st-gameData">—</strong></span>
    <span class="status-item">Mods: <strong id="st-mods">—</strong></span>
  </div>

  <!-- Stats -->
  <div class="stats-grid" id="stats-grid">
    <div class="stat-box"><div class="stat-value" id="s-req">0</div><div class="stat-label">Requests</div></div>
    <div class="stat-box"><div class="stat-value errors" id="s-err">0</div><div class="stat-label">Errors</div></div>
    <div class="stat-box"><div class="stat-value" id="s-avg">0ms</div><div class="stat-label">Avg Response</div></div>
    <div class="stat-box"><div class="stat-value" id="s-p95">0ms</div><div class="stat-label">P95 Response</div></div>
    <div class="stat-box"><div class="stat-value" id="s-socket">0</div><div class="stat-label">Socket Events</div></div>
  </div>

  <!-- Request Log -->
  <div class="card">
    <div class="card-header">
      <h2>📋 Request Log</h2>
      <div style="display:flex;gap:6px;align-items:center;">
        <button onclick="clearLogs()" style="background:none;border:1px solid var(--border);color:var(--text-dim);padding:3px 10px;border-radius:4px;cursor:pointer;font-size:11px;">Clear</button>
        <label><input type="checkbox" id="autoScroll" checked> Auto-scroll</label>
      </div>
    </div>
    <div class="log-controls">
      <select id="filterLevel">
        <option value="all">All levels</option>
        <option value="error">🔴 Errors only</option>
        <option value="warn">🟡 Warnings only</option>
        <option value="info">🔵 Info only</option>
      </select>
      <input type="text" id="filterSearch" placeholder="Search path, message..." style="flex:1;min-width:200px;">
    </div>
    <div class="log-table-wrap" id="log-wrap">
      <table>
        <thead><tr>
          <th style="width:55px">Time</th>
          <th style="width:55px">Level</th>
          <th style="width:50px">Method</th>
          <th>Path / Tag</th>
          <th style="width:65px">Status</th>
          <th style="width:65px">Duration</th>
          <th>Message</th>
        </tr></thead>
        <tbody id="log-body"></tbody>
      </table>
    </div>
  </div>

  <!-- Quick Test -->
  <div class="card">
    <div class="card-header">
      <h2>🧪 Quick Test</h2>
    </div>
    <div class="test-grid">
      <button class="test-btn" onclick="runTest('login')">
        <div class="label">POST /api</div>
        <div class="desc">login — type=login, action=login</div>
      </button>
      <button class="test-btn" onclick="runTest('hero')">
        <div class="label">POST /api</div>
        <div class="desc">hero list — type=hero, action=list</div>
      </button>
      <button class="test-btn" onclick="runTest('item')">
        <div class="label">POST /api</div>
        <div class="desc">item list — type=backpack, action=list</div>
      </button>
      <button class="test-btn" onclick="runTest('skill')">
        <div class="label">POST /api</div>
        <div class="desc">skill list — type=skill, action=list</div>
      </button>
      <button class="test-btn" onclick="runTest('equip')">
        <div class="label">POST /api</div>
        <div class="desc">equip list — type=equip, action=list</div>
      </button>
      <button class="test-btn" onclick="runTest('config')">
        <div class="label">GET config</div>
        <div class="desc">setting_Android.bin — server config</div>
      </button>
      <button class="test-btn" onclick="runTest('unknown')">
        <div class="label">POST /api</div>
        <div class="desc">unknown — type=??? (fallback test)</div>
      </button>
      <button class="test-btn" onclick="runTest('error')">
        <div class="label">POST /api</div>
        <div class="desc">force error — bad JSON test</div>
      </button>
    </div>
    <div class="test-result" id="test-result"></div>
  </div>

</div>

<script>
  // ── State ──────────────────────────────────────
  let lastLogId = 0;
  let allLogs = [];
  const REFRESH_MS = 2000;

  // ── Fetch all (single request every 2s) ───────
  async function fetchAll() {
    try {
      const res = await fetch('/api/debug/all');
      const d = await res.json();
      const s = d.stats || {};
      document.getElementById('st-uptime').textContent = s.uptimeFormatted || '—';
      document.getElementById('st-port').textContent = d.status?.port || '—';
      document.getElementById('st-gameData').textContent = d.status?.gameDataCollections + ' collections';
      document.getElementById('st-mods').textContent = d.status?.modsEnabled ? d.status.modsLoaded + ' loaded' : 'disabled';

      document.getElementById('s-req').textContent = s.totalRequests || 0;
      document.getElementById('s-err').textContent = s.totalErrors || 0;
      document.getElementById('s-avg').textContent = (s.avgResponseMs || 0) + 'ms';
      document.getElementById('s-p95').textContent = (s.p95ResponseMs || 0) + 'ms';
      document.getElementById('s-socket').textContent = s.totalSocketEvents || 0;

      document.getElementById('dot-server').className = 'status-dot ok';
      allLogs = d.logs || [];
      renderLogs();
    } catch {
      document.getElementById('dot-server').className = 'status-dot error';
    }
  }

  // ── Render logs ────────────────────────────────
  function renderLogs() {
    const level = document.getElementById('filterLevel').value;
    const search = document.getElementById('filterSearch').value.toLowerCase();
    const tbody = document.getElementById('log-body');

    let filtered = allLogs;
    if (level !== 'all') filtered = filtered.filter(l => l.level === level);
    if (search) filtered = filtered.filter(l =>
      (l.path || '').toLowerCase().includes(search) ||
      (l.message || '').toLowerCase().includes(search) ||
      (l.tag || '').toLowerCase().includes(search)
    );

    const wasAtBottom = logWrap.scrollHeight - logWrap.scrollTop - logWrap.clientHeight < 30;

    tbody.innerHTML = filtered.map(l => {
      const t = new Date(l.timestamp);
      const ts = t.toLocaleTimeString('en-GB', { hour12: false }) + '.' + String(t.getMilliseconds()).padStart(3, '0');
      const lvl = '<span class="level-badge ' + l.level + '">' + l.level + '</span>';
      const method = l.method ? '<span class="method-badge ' + l.method + '">' + l.method + '</span>' : '';
      const pathOrTag = l.path ? '<span class="path">' + escHtml(l.path) + '</span>' : '<span style="color:var(--text-dim)">' + escHtml(l.tag || '') + '</span>';
      const status = l.status ? '<span style="color:' + (l.status >= 400 ? 'var(--red)' : 'var(--green)') + '">' + l.status + '</span>' : '';
      let dur = '';
      if (l.duration != null) {
        const cls = l.duration > 500 ? 'vslow' : l.duration > 100 ? 'slow' : '';
        dur = '<span class="dur ' + cls + '">' + l.duration + 'ms</span>';
      }
      const msg = l.error ? '<span class="err-msg">' + escHtml(l.error.message || '') + '</span>'
        : (l.message ? escHtml(l.message) : (l.tag || ''));

      const rowCls = l.level === 'error' ? ' class="error"' : l.level === 'warn' ? ' class="warn"' : '';
      return '<tr' + rowCls + '><td class="ts">' + ts + '</td><td>' + lvl + '</td><td>' + method + '</td><td>' + pathOrTag + '</td><td>' + status + '</td><td>' + dur + '</td><td>' + msg + '</td></tr>';
    }).join('');

    if (wasAtBottom && document.getElementById('autoScroll').checked) {
      logWrap.scrollTop = logWrap.scrollHeight;
    }
  }

  const logWrap = document.getElementById('log-wrap');

  // ── Quick Test ─────────────────────────────────
  async function runTest(type) {
    const el = document.getElementById('test-result');
    el.className = 'test-result visible';
    el.style.borderColor = 'var(--accent)';
    el.textContent = '⏳ Running...';

    try {
      let url, body;
      if (type === 'config') {
        url = '/lzceshi/native_setting/Android/setting_Android.bin';
        const res = await fetch(url);
        const data = await res.json();
        el.className = 'test-result visible ok';
        el.textContent = '✅ GET ' + url + ' — ' + res.status + '\\n\\n' + JSON.stringify(data, null, 2);
      } else if (type === 'error') {
        url = '/api';
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=NOT_JSON{'
        });
        const data = await res.json();
        el.className = 'test-result visible ' + (res.ok ? 'ok' : 'fail');
        el.textContent = 'POST ' + url + ' — ' + res.status + '\\n\\n' + JSON.stringify(data, null, 2);
      } else {
        const payloads = {
          login:   { type: 'login', action: 'login', userId: 1001 },
          hero:    { type: 'hero', action: 'list' },
          item:    { type: 'backpack', action: 'list' },
          skill:   { type: 'skill', action: 'list' },
          equip:   { type: 'equip', action: 'list' },
          unknown: { type: 'nonexistent', action: 'test' },
        };
        url = '/api';
        body = JSON.stringify(payloads[type] || payloads.unknown);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(body)
        });
        const data = await res.json();
        const ok = data.ret === 0;
        el.className = 'test-result visible ' + (ok ? 'ok' : 'fail');
        el.textContent = 'POST ' + url + ' — ' + res.status + '\\nType: ' + (payloads[type] || payloads.unknown).type + '\\n\\n' + JSON.stringify(data, null, 2);
      }
    } catch (err) {
      el.className = 'test-result visible fail';
      el.textContent = '❌ Request failed: ' + err.message;
    }

    // Refresh logs after test
    setTimeout(fetchAll, 300);
  }

  // ── Helpers ────────────────────────────────────
  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function clearLogs() {
    document.getElementById('log-body').innerHTML = '';
    allLogs = [];
  }

  // ── Filters ────────────────────────────────────
  document.getElementById('filterLevel').addEventListener('change', renderLogs);
  document.getElementById('filterSearch').addEventListener('input', renderLogs);

  // ── Init & refresh loop ────────────────────────
  fetchAll();
  setInterval(fetchAll, REFRESH_MS);
</script>
</body>
</html>`;
}

module.exports = { getDashboardHtml };
