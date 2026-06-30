#!/usr/bin/env node

// ============================================================
// Debug Client
// A CLI tool to send test requests to the local emulator server.
// Useful for testing handlers and mods without running the game.
//
// Usage:
//   node tools/debug-client.js login
//   node tools/debug-client.js hero list
//   node tools/debug-client.js player info
//   node tools/debug-client.js --raw '{"type":"hero","action":"list"}'
// ============================================================

const http = require('http');

const SERVER_URL = process.env.SERVER_URL || 'http://127.0.0.1:8080';
const [, , ...args] = process.argv;

// ── Preset commands ──────────────────────────────────────────

const PRESETS = {
  login:     { type: 'login', action: 'login', userId: 1001 },
  'player info': { type: 'player', action: 'info' },
  'hero list':   { type: 'hero', action: 'list' },
  'item list':   { type: 'backpack', action: 'list' },
  'skill list':  { type: 'skill', action: 'list' },
  'equip list':  { type: 'equip', action: 'list' },
  'guild info':  { type: 'guild', action: 'info' },
};

const rawIdx = args.indexOf('--raw');
let payload;

if (rawIdx >= 0 && args[rawIdx + 1]) {
  payload = JSON.parse(args[rawIdx + 1]);
} else {
  const key = args.join(' ');
  payload = PRESETS[key];
  if (!payload) {
    console.error(`Unknown preset: "${key}"`);
    console.error('Available presets:', Object.keys(PRESETS).join(', '));
    console.error('Or use: node tools/debug-client.js --raw \'{"type":"...","action":"..."}\'');
    process.exit(1);
  }
}

// ── Send request ─────────────────────────────────────────────

const postData = JSON.stringify(payload);
const url = new URL('/api', SERVER_URL);

const req = http.request(
  {
    hostname: url.hostname,
    port: url.port,
    path: '/api',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(`data=${encodeURIComponent(postData)}`),
    },
  },
  (res) => {
    let body = '';
    res.on('data', (chunk) => (body += chunk));
    res.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        console.log(`\nResponse (${res.statusCode}):`);
        console.log(JSON.stringify(parsed, null, 2));
      } catch {
        console.log(`\nResponse (${res.statusCode}):`);
        console.log(body);
      }
    });
  },
);

req.on('error', (err) => {
  console.error(`\nConnection failed: ${err.message}`);
  console.error(`Make sure the server is running on ${SERVER_URL}`);
});

req.write(`data=${encodeURIComponent(postData)}`);
req.end();
