const { describe, it, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 8089;
const BASE = `http://127.0.0.1:${PORT}`;

let serverProcess;

function get(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(BASE + urlPath, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    }).on('error', reject);
  });
}

// ── Helper: Wait for server to be ready ──────────────────────
function waitForServer(retries = 30, delay = 200) {
  return new Promise((resolve, reject) => {
    function tryConnect(remaining) {
      if (remaining <= 0) return reject(new Error('Server did not start in time'));
      const req = http.get(`http://127.0.0.1:${PORT}/`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        setTimeout(() => tryConnect(remaining - 1), delay);
      });
      req.setTimeout(500, () => {
        req.destroy();
        setTimeout(() => tryConnect(remaining - 1), delay);
      });
    }
    tryConnect(retries);
  });
}

describe('Web App Refactoring Smoke Tests', () => {
  // Start server before tests
  before(async () => {
    console.log('[Test] Starting emulator server on port', PORT);
    serverProcess = spawn('node', [path.resolve(__dirname, '../server/src/index.js')], {
      env: { ...process.env, PORT: String(PORT), MODS_ENABLED: 'false' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('DRAGON BALL IDLE') || output.includes('Local Emulator Server')) {
        console.log('[Test] Server banner detected');
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('[Server Error]', data.toString());
    });

    serverProcess.on('error', (err) => {
      console.error('[Server Spawn Error]', err);
    });

    // Wait until server is actually accepting connections
    try {
      await waitForServer();
      console.log('[Test] Server is accepting connections');
    } catch (err) {
      console.error('[Test] Failed to start server:', err.message);
      throw err;
    }
  });

  // Stop server after tests
  after(() => {
    if (serverProcess) {
      console.log('[Test] Stopping server');
      serverProcess.kill();
    }
  });

  describe('Static Game Client Serving', () => {
    it('GET / redirects to /debug dashboard', async () => {
      const r = await get('/');
      assert.strictEqual(r.status, 302);
      assert.strictEqual(r.headers.location, '/debug');
    });

    it('GET /debug serves the debug dashboard', async () => {
      const r = await get('/debug');
      assert.strictEqual(r.status, 200);
      assert.ok(r.body.includes('Debug Dashboard') || r.body.includes('DRAGON BALL'));
    });

    it('GET /index.html serves game client directly', async () => {
      const r = await get('/index.html');
      assert.strictEqual(r.status, 200);
      assert.ok(r.body.includes('egret-player'));
      assert.ok(r.body.includes('browser-boot.js'));
    });

    it('GET /browser-boot.js serves native bridge mock', async () => {
      const r = await get('/browser-boot.js');
      assert.strictEqual(r.status, 200);
      assert.ok(r.body.includes('startTsGame'));
    });

    it('GET /js/egret.min_d9413192.js serves engine script from game_source/js', async () => {
      const r = await get('/js/egret.min_d9413192.js');
      assert.strictEqual(r.status, 200);
      assert.ok(r.body.length > 1000);
    });

    it('GET /js/main.min_7eae4d6e.js serves main game JS from game_source/js', async () => {
      const r = await get('/js/main.min_7eae4d6e.js');
      assert.strictEqual(r.status, 200);
      assert.ok(r.body.length > 100000);
    });

    it('GET /resource/default.res.json serves resources manifest from game_source/resource', async () => {
      const r = await get('/resource/default.res.json');
      assert.strictEqual(r.status, 200);
      const manifest = JSON.parse(r.body);
      assert.ok(manifest.groups);
      assert.ok(manifest.resources);
    });
  });

  describe('API & Config endpoints', () => {
    it('GET setting_Android.bin returns XOR-encrypted settings', async () => {
      const r = await get('/lzceshi/native_setting/Android/setting_Android.bin');
      assert.strictEqual(r.status, 200);
      assert.strictEqual(r.headers['content-type'], 'application/octet-stream');
      assert.ok(r.body.length > 0);
    });

    it('GET loginchecknative returns login details', async () => {
      const r = await get('/lzceshi/native_setting/Android/loginchecknative');
      assert.strictEqual(r.status, 200);
      const data = JSON.parse(r.body);
      assert.strictEqual(data.code, 0);
      assert.ok(data.loginServer);
    });
  });
});
