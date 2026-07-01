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

describe('Web App Refactoring Smoke Tests', () => {
  // Start server before tests
  before((done) => {
    console.log('[Test] Starting emulator server on port', PORT);
    serverProcess = spawn('node', [path.resolve(__dirname, '../server/src/index.js')], {
      env: { ...process.env, PORT: PORT, MODS_ENABLED: 'false' }
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('DRAGON BALL IDLE') || output.includes('Local Emulator Server')) {
        console.log('[Test] Server started successfully');
        done();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('[Server Error]', data.toString());
    });

    serverProcess.on('error', (err) => {
      console.error('[Server Spawn Error]', err);
      done(err);
    });
  });

  // Stop server after tests
  after(() => {
    if (serverProcess) {
      console.log('[Test] Stopping server');
      serverProcess.kill();
    }
  });

  describe('Static Game Client Serving', () => {
    it('GET / serves client index.html', async () => {
      const r = await get('/');
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
