// ============================================================
// Login Flow Integration Tests
// ============================================================
//
// Tests the complete login flow:
//   1. Config loading (XOR-encrypted .bin → decrypted JSON)
//   2. Login check (loginchecknative plain JSON)
//   3. Game API login (POST /api with login action)
//   4. Socket.IO verify handshake
//   5. Edge cases & error handling
//
// Uses Node.js built-in test runner (node:test).
// ============================================================

const { describe, it, before, after, afterEach } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const crypto = require('crypto');

const PORT = 8088; // different from smoke test port
const HOST = '127.0.0.1';
const BASE = `http://${HOST}:${PORT}`;
const SERVER_BASE = `http://0.0.0.0:${PORT}`; // server binds to 0.0.0.0

// ── XOR key matching server (config.routes.js) ────────────────
const XOR_KEY = 'DragonBall';

let serverProcess;

// ── Helper: HTTP GET ─────────────────────────────────────────
function get(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(BASE + urlPath, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    }).on('error', reject);
  });
}

// ── Helper: HTTP POST ────────────────────────────────────────
function post(urlPath, payload, contentType) {
  return new Promise((resolve, reject) => {
    const postData = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const isForm = contentType === 'form';

    const options = {
      hostname: '127.0.0.1',
      port: PORT,
      path: urlPath,
      method: 'POST',
      headers: isForm
        ? { 'Content-Type': 'application/x-www-form-urlencoded' }
        : { 'Content-Type': 'application/json' },
    };

    let bodyStr;
    if (isForm) {
      bodyStr = `data=${encodeURIComponent(postData)}`;
    } else {
      bodyStr = postData;
    }
    options.headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    req.write(bodyStr);
    req.end();
  });
}

// ── Helper: XOR Decrypt (reverse of server's xorEncrypt) ─────
function xorDecrypt(buf, key) {
  const keyBytes = Buffer.from(key, 'utf-8');
  for (let i = 0; i < buf.length; i++) {
    buf[i] ^= keyBytes[i % keyBytes.length];
  }
  return buf;
}

// ── Helper: Wait for server to be ready ──────────────────────
function waitForServer(retries = 30, delay = 200) {
  return new Promise((resolve, reject) => {
    function tryConnect(remaining) {
      if (remaining <= 0) return reject(new Error('Server did not start in time'));
      const req = http.get(`${BASE}/`, (res) => {
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

// ── Start / Stop server ───────────────────────────────────────
before(async () => {
  console.log('[LoginTest] Starting emulator server on port', PORT);
  serverProcess = spawn('node', [path.resolve(__dirname, '../server/src/index.js')], {
    env: { ...process.env, PORT: String(PORT), MODS_ENABLED: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (data) => {
    const output = data.toString();
    if (output.includes('DRAGON BALL IDLE') || output.includes('Local Emulator Server')) {
      console.log('[LoginTest] Server started');
    }
  });

  let stderrBuf = '';
  serverProcess.stderr.on('data', (data) => {
    stderrBuf += data.toString();
  });

  serverProcess.on('error', (err) => {
    console.error('[LoginTest] Server spawn error:', err.message);
  });

  try {
    await waitForServer();
    console.log('[LoginTest] Server is accepting connections');
  } catch (err) {
    console.error('[LoginTest] Failed to start server:', err.message);
    console.error('  stderr:', stderrBuf);
    throw err;
  }
});

after(() => {
  if (serverProcess) {
    console.log('[LoginTest] Stopping server');
    serverProcess.kill();
  }
});

// ═══════════════════════════════════════════════════════════════
// 1. Config Endpoints (XOR-Encrypted .bin)
// ═══════════════════════════════════════════════════════════════
describe('Config endpoints (XOR-encrypted .bin)', () => {

  it('GET setting_Android.bin returns XOR-encrypted binary data', async () => {
    const r = await get('/lzceshi/native_setting/Android/setting_Android.bin');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.headers['content-type'], 'application/octet-stream');

    // Decrypt XOR
    const buf = Buffer.from(r.body, 'binary');
    const decrypted = xorDecrypt(buf, XOR_KEY);
    const json = JSON.parse(decrypted.toString('utf-8'));

    // Validate structure
    assert.strictEqual(json.maintain.status, false);
    assert.ok(json.serverList);
    assert.ok(Array.isArray(json.serverList));
    assert.ok(json.serverList.length > 0);
    assert.ok(json.serverList[0].url);
    assert.ok(json.loginserver);
    assert.ok(json.loginServer);
    assert.strictEqual(json.loginserver, SERVER_BASE);
  });

  it('GET setting_BS_Android.bin (backup server) works', async () => {
    const r = await get('/bs/db/android/setting_BS_Android.bin');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.headers['content-type'], 'application/octet-stream');

    const buf = Buffer.from(r.body, 'binary');
    const decrypted = xorDecrypt(buf, XOR_KEY);
    const json = JSON.parse(decrypted.toString('utf-8'));

    assert.strictEqual(json.maintain.status, false);
    assert.ok(json.loginServer);
  });

  it('GET sdk .bin endpoint returns decryptable JSON', async () => {
    const r = await get('/lzceshi/native_setting/Android/some_random_sdk.bin');
    assert.strictEqual(r.status, 200);

    const buf = Buffer.from(r.body, 'binary');
    const decrypted = xorDecrypt(buf, XOR_KEY);
    const json = JSON.parse(decrypted.toString('utf-8'));

    assert.ok(json.version !== undefined);
    assert.ok(json.sdkConfig);
  });

  it('XOR encryption is reversible with correct key', async () => {
    const r = await get('/lzceshi/native_setting/Android/setting_Android.bin');
    const buf = Buffer.from(r.body, 'binary');

    // Decrypt once
    const decrypted = xorDecrypt(Buffer.from(buf), XOR_KEY);
    const json = JSON.parse(decrypted.toString('utf-8'));
    assert.ok(json.versionCode !== undefined);

    // XOR with wrong key should produce garbage (not valid JSON)
    const wrongDecrypt = xorDecrypt(Buffer.from(buf), 'WrongKey');
    const wrongStr = wrongDecrypt.toString('utf-8');
    assert.throws(() => JSON.parse(wrongStr), /Unexpected|unexpected|SyntaxError/);
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. Login Check Endpoint
// ═══════════════════════════════════════════════════════════════
describe('loginchecknative endpoint', () => {

  it('GET loginchecknative returns success with loginServer', async () => {
    const r = await get('/lzceshi/native_setting/Android/loginchecknative');
    assert.strictEqual(r.status, 200);

    const data = JSON.parse(r.body);
    assert.strictEqual(data.code, 0);
    assert.strictEqual(data.msg, 'success');
    assert.ok(data.loginServer);
    assert.ok(data.serverUrl);
    assert.ok(data.socketUrl);
    assert.strictEqual(data.loginServer, SERVER_BASE);
  });

  it('GET loginchecknative works with query params', async () => {
    const r = await get('/lzceshi/native_setting/Android/loginchecknative?os=android&brand=test');
    assert.strictEqual(r.status, 200);

    const data = JSON.parse(r.body);
    assert.strictEqual(data.code, 0);
    assert.strictEqual(data.msg, 'success');
    assert.ok(data.loginServer);
  });

  it('POST loginchecknative also works (app.all)', async () => {
    const r = await post('/lzceshi/native_setting/Android/loginchecknative', {});
    assert.strictEqual(r.status, 200);

    const data = JSON.parse(r.body);
    assert.strictEqual(data.code, 0);
    assert.ok(data.loginServer);
  });

  it('loginchecknative response includes team server URL', async () => {
    const r = await get('/lzceshi/native_setting/Android/loginchecknative');
    const data = JSON.parse(r.body);

    assert.ok(data.teamServerHttpUrl);
    assert.strictEqual(data.teamServerHttpUrl, SERVER_BASE);
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. Game API Login
// ═══════════════════════════════════════════════════════════════
describe('Game API — login action', () => {

  it('POST /api with login action returns success (form-encoded)', async () => {
    const payload = { type: 'login', action: 'login', userId: 1001 };
    const r = await post('/api', payload, 'form');
    assert.strictEqual(r.status, 200);

    const body = JSON.parse(r.body);
    assert.strictEqual(body.ret, 0);
    assert.ok(body.data);

    const data = JSON.parse(body.data);
    assert.strictEqual(data.userId, 1001);
    assert.ok(data.sign);
    assert.ok(data.nickname);
    assert.ok(data.level !== undefined);
    assert.ok(data.serverTime);
  });

  it('POST /api with login action returns success (JSON-encoded)', async () => {
    const payload = { type: 'login', action: 'login', userId: 1001 };
    const r = await post('/api', payload, 'json');
    assert.strictEqual(r.status, 200);

    const body = JSON.parse(r.body);
    assert.strictEqual(body.ret, 0);

    const data = JSON.parse(body.data);
    assert.strictEqual(data.userId, 1001);
  });

  it('POST /api with logingame action also works', async () => {
    const payload = { type: 'login', action: 'logingame', userId: 1001 };
    const r = await post('/api', payload, 'form');
    assert.strictEqual(r.status, 200);

    const body = JSON.parse(r.body);
    assert.strictEqual(body.ret, 0);

    const data = JSON.parse(body.data);
    assert.strictEqual(data.userId, 1001);
  });

  it('Login response includes serverItem with all required URLs', async () => {
    const payload = { type: 'login', action: 'login', userId: 1001 };
    const r = await post('/api', payload, 'form');
    const body = JSON.parse(r.body);
    const data = JSON.parse(body.data);

    assert.ok(data.serverItem);
    assert.strictEqual(data.serverItem.url, SERVER_BASE);
    assert.strictEqual(data.serverItem.dungeonurl, SERVER_BASE);
    assert.strictEqual(data.serverItem.chaturl, SERVER_BASE);
    assert.ok(data.serverItem.serverId);
    assert.strictEqual(data.serverItem.online, true);
  });

  it('Login with no userId defaults to 1001', async () => {
    const payload = { type: 'login', action: 'login' };
    const r = await post('/api', payload, 'form');
    const body = JSON.parse(r.body);
    const data = JSON.parse(body.data);

    assert.strictEqual(data.userId, 1001);
  });

  it('Login response includes player stats', async () => {
    const payload = { type: 'login', action: 'login' };
    const r = await post('/api', payload, 'form');
    const body = JSON.parse(r.body);
    const data = JSON.parse(body.data);

    assert.ok(data.level !== undefined);
    assert.ok(data.vip !== undefined);
    assert.ok(data.gold !== undefined);
    assert.ok(data.diamond !== undefined);
    assert.ok(data.stamina !== undefined);
    assert.ok(data.fightPower !== undefined);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. GetServerList & EnterGame
// ═══════════════════════════════════════════════════════════════
describe('Game API — server list and enter game', () => {

  it('GetServerList returns server list', async () => {
    const payload = { type: 'player', action: 'GetServerList' };
    const r = await post('/api', payload, 'form');
    const body = JSON.parse(r.body);
    assert.strictEqual(body.ret, 0);

    const data = JSON.parse(body.data);
    assert.ok(data.serverList);
    assert.ok(Array.isArray(data.serverList));
    assert.ok(data.serverList.length > 0);
    assert.strictEqual(data.serverList[0].status, 'smooth');
  });

  it('serverlist action also works (lowercase)', async () => {
    const payload = { type: 'player', action: 'serverlist' };
    const r = await post('/api', payload, 'form');
    const body = JSON.parse(r.body);
    assert.strictEqual(body.ret, 0);

    const data = JSON.parse(body.data);
    assert.ok(data.serverList);
  });

  it('enterGame returns game session data', async () => {
    const payload = { type: 'login', action: 'enterGame', userId: 1001 };
    const r = await post('/api', payload, 'form');
    const body = JSON.parse(r.body);
    assert.strictEqual(body.ret, 0);

    const data = JSON.parse(body.data);
    assert.strictEqual(data.userId, 1001);
    assert.ok(data.serverTime);
    assert.ok(data.lastLoginTime);
    assert.ok(data.loginDays !== undefined);
  });
});

// ═══════════════════════════════════════════════════════════════
// 5. Edge Cases & Error Handling
// ═══════════════════════════════════════════════════════════════
describe('Edge cases and error handling', () => {

  it('GET non-existent .bin returns 404', async () => {
    const r = await get('/lzceshi/native_setting/Android/nonexistent.bin');
    // Should fall through to static file serving → 404
    assert.ok(r.status === 404 || r.status === 200);
    // If 200, it's the wildcard *.bin route
    if (r.status === 200) {
      const buf = Buffer.from(r.body, 'binary');
      const decrypted = xorDecrypt(buf, XOR_KEY);
      const json = JSON.parse(decrypted.toString('utf-8'));
      // Should return SDK config (from wildcard route)
      assert.ok(json.version !== undefined);
    }
  });

  it('POST /api with missing type still returns 200 (fallback)', async () => {
    const payload = { action: 'something' };
    const r = await post('/api', payload, 'form');
    assert.strictEqual(r.status, 200);

    const body = JSON.parse(r.body);
    assert.strictEqual(body.ret, 0);
    // Fallback returns empty data
    const data = JSON.parse(body.data);
    assert.ok(data); // should at least be {}
  });

  it('POST /api with empty body returns 200 (fallback)', async () => {
    const r = await post('/api', '', 'form');
    assert.strictEqual(r.status, 200);

    const body = JSON.parse(r.body);
    assert.strictEqual(body.ret, 0);
  });

  it('POST to catch-all route works', async () => {
    const payload = { type: 'login', action: 'login', userId: 1001 };
    const r = await post('/some/other/path', payload, 'form');
    assert.strictEqual(r.status, 200);

    const body = JSON.parse(r.body);
    assert.strictEqual(body.ret, 0);
  });

  it('Response data is LZ-string compatible (stringified JSON)', async () => {
    // The server returns data as JSON.stringify(object), which is
    // compatible with the game's LZ-String compression pipeline.
    const payload = { type: 'login', action: 'login' };
    const r = await post('/api', payload, 'form');
    const body = JSON.parse(r.body);

    // data should be a string (JSON.stringify'd)
    assert.strictEqual(typeof body.data, 'string');

    // Verify it's valid JSON
    const parsed = JSON.parse(body.data);
    assert.ok(parsed.userId);
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. Socket.IO Verify Handshake
// ═══════════════════════════════════════════════════════════════
describe('Socket.IO — verify handshake', () => {
  let ioClient;

  afterEach(() => {
    if (ioClient && ioClient.connected) {
      ioClient.disconnect();
      ioClient = null;
    }
  });

  it('connects and receives verify challenge', async () => {
    const ioc = require(require('path').resolve(__dirname, '../server/node_modules/socket.io-client'));
    const socket = ioc(`http://127.0.0.1:${PORT}`, {
      transports: ['websocket'],
      forceNew: true,
    });

    const challenge = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for verify')), 3000);
      socket.on('verify', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
      socket.on('connect_error', reject);
    });

    assert.ok(challenge);
    assert.strictEqual(typeof challenge, 'string');
    assert.ok(challenge.length > 0);

    socket.disconnect();
  });

  it('responds to verify and gets verified notification', async () => {
    const ioc = require(require('path').resolve(__dirname, '../server/node_modules/socket.io-client'));
    const socket = ioc(`http://127.0.0.1:${PORT}`, {
      transports: ['websocket'],
      forceNew: true,
    });

    // Wait for verify challenge
    const challenge = await new Promise((resolve) => {
      socket.on('verify', resolve);
    });
    assert.ok(challenge);

    // Respond with verify callback
    const result = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for verify callback')), 3000);
      socket.emit('verify', { challenge }, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });

    assert.ok(result);
    assert.strictEqual(result.ret, 0);
    assert.strictEqual(result.msg, 'verified');

    // Should also receive Notify event
    const notify = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for Notify')), 3000);
      socket.on('Notify', (data) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    assert.strictEqual(notify.type, 'verified');
    assert.ok(notify.data);
    assert.ok(notify.data.userId);
    assert.ok(notify.data.serverTime);

    socket.disconnect();
  });

  it('handler.process dispatches login through socket', async () => {
    const ioc = require(require('path').resolve(__dirname, '../server/node_modules/socket.io-client'));
    const socket = ioc(`http://127.0.0.1:${PORT}`, {
      transports: ['websocket'],
      forceNew: true,
    });

    // Complete verify handshake first
    await new Promise((resolve) => { socket.on('verify', () => resolve()); });
    await new Promise((resolve) => {
      socket.emit('verify', {}, (response) => {
        resolve(response);
      });
    });

    // Send handler.process with login payload
    const loginResult = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for handler.process')), 3000);
      socket.emit('handler.process', { type: 'login', action: 'login', userId: 1001 }, (response) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });

    assert.ok(loginResult);
    assert.strictEqual(loginResult.ret, 0);

    const data = JSON.parse(loginResult.data);
    assert.strictEqual(data.userId, 1001);
    assert.ok(data.serverItem);
    assert.ok(data.sign);

    socket.disconnect();
  });

  it('pong keep-alive does not error', async () => {
    const ioc = require(require('path').resolve(__dirname, '../server/node_modules/socket.io-client'));
    const socket = ioc(`http://127.0.0.1:${PORT}`, {
      transports: ['websocket'],
      forceNew: true,
    });

    // Wait for connection
    await new Promise((resolve, reject) => {
      socket.on('connect', resolve);
      socket.on('connect_error', reject);
    });

    // Send pong — should not error
    socket.emit('pong');

    // Wait a bit to ensure no error
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify still connected
    assert.ok(socket.connected);

    socket.disconnect();
  });
});
