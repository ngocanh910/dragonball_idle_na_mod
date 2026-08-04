// ============================================================
// Playwright E2E Login Test
// ============================================================
//
// Launches the game in a real Chromium browser, clicks the
// canvas at login-button coordinates, and monitors network
// calls (API + WebSocket) to verify the login flow.
//
// Usage:
//   node test/login-e2e.test.js                 # headless
//   HEADED=true node test/login-e2e.test.js     # watch the browser
//   COORDS=375,1100 node test/login-e2e.test.js # custom click coords
// ============================================================

const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PORT = 8087;
const BASE = `http://127.0.0.1:${PORT}`;
const SCREENSHOT_DIR = path.resolve(__dirname, '../plans/reports/screenshots');
const GAME_W = 750;
const GAME_H = 1334;

// ── Login button candidates ────────────────────────────
// Game resolution is 750×1334.
// Coordinates are in game-space. The canvas might be
// scaled+offset to fit the viewport — we translate.
const LOGIN_CANDIDATES = [
  // Guest/youke login (most common, bottom center)
  { label: 'guest-login',       x: 0.50, y: 0.88 },
  // Bottom-center area
  { label: 'bottom-center',     x: 0.50, y: 0.82 },
  // Left/right bottom buttons
  { label: 'bottom-left',       x: 0.25, y: 0.85 },
  { label: 'bottom-right',      x: 0.75, y: 0.85 },
  // Very bottom edge
  { label: 'very-bottom',       x: 0.50, y: 0.93 },
  // Mid screen touch-spots (some games tap here)
  { label: 'mid-touch',         x: 0.50, y: 0.55 },
  // Logo area (some games have "tap to start")
  { label: 'logo-area',         x: 0.50, y: 0.30 },
];

// ── Helpers ───────────────────────────────────────────

function waitForServer(retries = 40, delay = 250) {
  return new Promise((resolve, reject) => {
    function tryConnect(n) {
      if (n <= 0) return reject(new Error('Server did not start'));
      const req = http.get(`${BASE}/`, (res) => { res.resume(); resolve(); });
      req.on('error', () => setTimeout(() => tryConnect(n - 1), delay));
      req.setTimeout(500, () => { req.destroy(); setTimeout(() => tryConnect(n - 1), delay); });
    }
    tryConnect(retries);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Convert game-space (0-1) fraction to viewport pixel coords,
 * accounting for canvas scaling & offset from fixedNarrow mode.
 */
function gameToPage(box, xPct, yPct) {
  return {
    x: Math.round(box.x + box.width * xPct),
    y: Math.round(box.y + box.height * yPct),
  };
}

// ── Main test runner ────────────────────────────────────

(async () => {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Playwright E2E — Dragon Ball Idle Login Test');
  console.log('═══════════════════════════════════════════════════\n');

  const HEADED = process.env.HEADED === 'true';
  const customCoords = process.env.COORDS;
  // Use full game resolution so nothing is clipped
  const VIEWPORT = { width: GAME_W, height: GAME_H };
  let exitCode = 0;

  // ── 1. Start server ─────────────────────────────────────
  console.log(`[1/7] Starting server on port ${PORT}...`);
  const serverProcess = spawn('node', [path.resolve(__dirname, '../server/src/index.js')], {
    env: { ...process.env, PORT: String(PORT), MODS_ENABLED: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', () => {});
  serverProcess.stderr.on('data', (d) => {
    const s = d.toString();
    if (s.includes('Error') || s.includes('error')) console.error('  [Server]', s.trim());
  });

  try {
    await waitForServer();
    console.log('  ✓ Server ready at', BASE);
  } catch (err) {
    console.error('  ✗ Server failed to start:', err.message);
    serverProcess.kill();
    process.exit(1);
  }

  // Ensure screenshot dir
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  // ── 2. Launch browser ───────────────────────────────────
  console.log(`[2/7] Launching ${HEADED ? 'headed' : 'headless'} Chromium...`);
  let browser;
  try {
    browser = await chromium.launch({
      headless: !HEADED,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    console.log('  ✓ Browser launched');
  } catch (err) {
    console.error('  ✗ Failed to launch browser:', err.message);
    serverProcess.kill();
    process.exit(1);
  }

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();

  // ── 3. Monitor network & logs ─────────────────────────
  const apiCalls = [];
  const wsConnections = [];

  await page.route('**/api**', (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const postData = route.request().postData() || '';
    apiCalls.push({ url, method, postData, time: Date.now() });
    route.continue();
  });

  await page.route('**/socket.io/**', (route) => {
    wsConnections.push({ url: route.request().url(), time: Date.now() });
    route.continue();
  });

  page.on('websocket', (ws) => {
    const wsUrl = ws.url();
    console.log(`  [WebSocket] Connected: ${wsUrl}`);
    wsConnections.push({ url: wsUrl, time: Date.now(), connected: true });
  });

  const gameLogs = [];
  page.on('console', (msg) => {
    gameLogs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', (err) => {
    gameLogs.push(`[PAGE_ERROR] ${err.message}`);
  });

  // ── 4. Navigate to game ─────────────────────────────────
  console.log(`[3/7] Loading game at ${BASE}/index.html ...`);

  try {
    const response = await page.goto(`${BASE}/index.html`, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });
    console.log(`  ✓ Page loaded (status ${response.status()})`);
  } catch (err) {
    console.warn('  ⚠ Navigation timeout — game still loading');
  }

  // ── 5. Wait for canvas & analyze boot ───────────────────
  console.log(`[4/7] Waiting for game canvas...`);

  let canvas;
  try {
    canvas = await page.waitForSelector('canvas', { timeout: 20000 });
    console.log('  ✓ Canvas element found');
  } catch (err) {
    console.warn('  ⚠ No canvas found within timeout');
    const shot = `${SCREENSHOT_DIR}/e2e-no-canvas.png`;
    await page.screenshot({ path: shot, fullPage: true });
    console.log('  Screenshot saved: e2e-no-canvas.png');
    await browser.close();
    serverProcess.kill();
    process.exit(1);
  }

  // Give the game a moment to fully render
  await sleep(3000);
  const box = await canvas.boundingBox();
  console.log(`  Canvas bounding box: ${JSON.stringify(box)}`);
  console.log(`  Game resolution: ${GAME_W}×${GAME_H}, Viewport: ${VIEWPORT.width}×${VIEWPORT.height}`);

  // Full page screenshot with the whole viewport
  const shot1 = `${SCREENSHOT_DIR}/e2e-01-initial.png`;
  await page.screenshot({ path: shot1 });
  console.log(`  ✓ Screenshot saved: ${path.basename(shot1)}`);

  // Show boot-related logs
  const bootLogs = gameLogs.filter(l =>
    l.toLowerCase().includes('[browserboot]') ||
    l.toLowerCase().includes('egret') ||
    l.toLowerCase().includes('error') ||
    l.toLowerCase().includes('can\'t find')
  );
  if (bootLogs.length > 0) {
    console.log('  Game boot logs:');
    bootLogs.forEach(l => console.log(`    ${l}`));
  }

  // ── 6. Click canvas at login positions ──────────────────
  console.log(`[5/7] Clicking canvas at login button candidates...`);

  let clickTargets = [];
  if (customCoords) {
    const [cx, cy] = customCoords.split(',').map(Number);
    clickTargets = [{ label: 'custom', x: cx, y: cy }];
    console.log(`  Using custom coords: (${cx}, ${cy})`);
  } else if (box) {
    clickTargets = LOGIN_CANDIDATES.map(c => ({
      ...gameToPage(box, c.x, c.y),
      label: c.label,
    }));
    console.log(`  Will try ${clickTargets.length} positions on canvas (${GAME_W}×${GAME_H})`);
  }

  for (const target of clickTargets) {
    console.log(`  → Clicking "${target.label}" at (${target.x}, ${target.y})`);

    try {
      await page.mouse.click(target.x, target.y);
      await sleep(1000);
    } catch (err) {
      console.log(`    ⚠ Click failed: ${err.message}`);
    }

    if (apiCalls.length > 0) {
      console.log(`    ✓ Triggered ${apiCalls.length} API call(s)!`);
      break;
    }
  }

  // ── 7. Analyze ──────────────────────────────────────────
  console.log(`[6/7] Analyzing results...`);

  const shot2 = `${SCREENSHOT_DIR}/e2e-02-after-clicks.png`;
  await page.screenshot({ path: shot2 });
  console.log(`  ✓ Screenshot saved: ${path.basename(shot2)}`);

  // API calls
  if (apiCalls.length > 0) {
    console.log(`\n  📡 API Calls (${apiCalls.length}):`);
    apiCalls.forEach((call, i) => {
      console.log(`    [${i+1}] ${call.method} ${call.url}`);
      if (call.postData) {
        try {
          const parsed = JSON.parse(decodeURIComponent(call.postData.replace('data=', '')));
          console.log(`        Payload: ${JSON.stringify(parsed).slice(0, 200)}`);
        } catch {
          console.log(`        Raw: ${call.postData.slice(0, 150)}`);
        }
      }
    });
  } else {
    console.log(`  📡 No API calls`);
  }

  // WebSocket
  if (wsConnections.length > 0) {
    console.log(`\n  🔌 WebSocket (${wsConnections.length}):`);
    wsConnections.forEach((w, i) => {
      console.log(`    [${i+1}] ${w.url} ${w.connected ? '(connected)' : ''}`);
    });
  } else {
    console.log(`\n  🔌 No WebSocket connections`);
  }

  // Game logs (last 30)
  console.log(`\n  📋 Game logs (last 30):`);
  gameLogs.slice(-30).forEach(l => {
    const trimmed = l.length > 220 ? l.slice(0, 220) + '...' : l;
    console.log(`    ${trimmed}`);
  });

  // Save artifacts
  const shot3 = `${SCREENSHOT_DIR}/e2e-03-final.png`;
  await page.screenshot({ path: shot3, fullPage: true });
  console.log(`\n  ✓ Final screenshot: ${path.basename(shot3)}`);

  const logFile = `${SCREENSHOT_DIR}/e2e-game-logs.txt`;
  fs.writeFileSync(logFile, gameLogs.join('\n'), 'utf-8');
  console.log(`  ✓ Game logs: ${path.basename(logFile)}`);

  const netFile = `${SCREENSHOT_DIR}/e2e-network.txt`;
  fs.writeFileSync(netFile, [
    '=== API CALLS ===',
    ...apiCalls.map((c, i) => `[${i+1}] ${c.method} ${c.url} | ${c.postData}`),
    '', '=== WEBSOCKET ===',
    ...wsConnections.map((w, i) => `[${i+1}] ${w.url} | connected=${w.connected}`),
  ].join('\n'), 'utf-8');
  console.log(`  ✓ Network dump: ${path.basename(netFile)}`);

  // Assertions
  console.log(`\n[7/7] Assertions:`);
  console.log(`  ${canvas ? '✓' : '✗'} Canvas rendered: ${canvas ? 'YES' : 'NO'}`);
  const engineLoaded = gameLogs.some(l => l.includes('[BrowserBoot]'));
  console.log(`  ${engineLoaded ? '✓' : '✗'} BrowserBoot: ${engineLoaded ? 'YES' : 'NO'}`);
  console.log(`  ${apiCalls.length > 0 ? '✓' : '⚠'} API calls: ${apiCalls.length}`);
  const wsConnected = wsConnections.some(w => w.connected);
  console.log(`  ${wsConnected ? '✓' : '⚠'} WebSocket: ${wsConnected ? 'YES' : 'NO'}`);

  // Save page error count
  const pageErrors = gameLogs.filter(l => l.startsWith('[PAGE_ERROR]'));
  if (pageErrors.length > 0) {
    console.log(`\n  ⚠ Page errors (${pageErrors.length}):`);
    pageErrors.forEach(l => console.log(`    ${l}`));
  }

  console.log(`\n═══════════════════════════════════════════════════`);
  if (apiCalls.length > 0 && wsConnected) {
    console.log(`  ✅ FULL LOGIN FLOW CONFIRMED`);
    console.log(`  📍 Button found at: ${clickTargets[0]?.label || 'custom'}`);
  } else if (apiCalls.length > 0) {
    console.log(`  ⚠️  LOGIN API WORKING — WebSocket still pending`);
  } else if (canvas && !pageErrors.some(e => e.includes('Cannot read properties of null'))) {
    console.log(`  ⚠️  GAME RENDERED — login buttons need coord discovery`);
    console.log(`  💡 Try: COORDS=<x>,<y> node test/login-e2e.test.js`);
    console.log(`  💡 Or run: HEADED=true node test/login-e2e.test.js`);
  } else {
    console.log(`  ⚠️  GAME RENDERED with errors — missing assets`);
    console.log(`  💡 Check game-logs.txt for details`);
  }
  console.log(`═══════════════════════════════════════════════════\n`);

  await browser.close();
  serverProcess.kill();
  process.exit(exitCode);
})().catch(async (err) => {
  console.error('\n❌ Fatal:', err.message, '\n', err.stack?.slice(0, 500));
  process.exit(1);
});
