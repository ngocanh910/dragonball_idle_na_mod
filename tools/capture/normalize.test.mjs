import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalize } from './normalize.mjs';

test('normalize converts producer exchanges to unified actions.jsonl', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cap-'));
  const shots = join(dir, 'shots'); const ui = join(dir, 'ui');
  mkdirSync(shots, { recursive: true }); mkdirSync(ui, { recursive: true });
  const input = join(dir, 'flows.jsonl');
  const output = join(dir, 'actions.jsonl');
  writeFileSync(input, [
    JSON.stringify({ conn: 'c1', seq: 1, ts: 1000, kind: 'exchange', type: 'hero', action: 'getAttrs', req: { heros: [1] }, res: { ret: 0, data: '{}' } }),
    JSON.stringify({ conn: 'c1', seq: 2, ts: 1500, kind: 'notify', type: 'activity', body: { ret: 0 } }),
  ].join('\n'));
  writeFileSync(join(shots, '1000.png'), 'x'); // screenshot aligned to seq 1
  normalize({ inputPath: input, shotsDir: shots, uiDir: ui, outputPath: output });
  const lines = readFileSync(output, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(lines.length, 3);
  assert.deepEqual(lines[0], { seq: 1, ts: 1000, direction: 'req', type: 'hero', action: 'getAttrs', body: { heros: [1] }, screenshot: 'shots/1000.png' });
  assert.deepEqual(lines[1], { seq: 1, ts: 1000, direction: 'res', type: 'hero', action: 'getAttrs', body: { ret: 0, data: '{}' }, screenshot: 'shots/1000.png' });
  assert.deepEqual(lines[2], { seq: 2, ts: 1500, direction: 'notify', type: 'activity', body: { ret: 0 } });
  assert.equal(lines[1].direction, 'res');
  rmSync(dir, { recursive: true, force: true });
});

test('notify line stays single with no req/res split', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cap-'));
  const shots = join(dir, 'shots'); const ui = join(dir, 'ui');
  mkdirSync(shots, { recursive: true }); mkdirSync(ui, { recursive: true });
  const input = join(dir, 'flows.jsonl'); const output = join(dir, 'actions.jsonl');
  writeFileSync(input, JSON.stringify({ conn: 'c1', seq: 9, ts: 5000, kind: 'notify', type: 'activity', body: { a: 1 } }) + '\n');
  normalize({ inputPath: input, shotsDir: shots, uiDir: ui, outputPath: output });
  const lines = readFileSync(output, 'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0], { seq: 9, ts: 5000, direction: 'notify', type: 'activity', body: { a: 1 } });
  rmSync(dir, { recursive: true, force: true });
});
