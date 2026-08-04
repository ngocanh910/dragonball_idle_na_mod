import test from 'node:test';
import assert from 'node:assert/strict';
import { diffValues, VOLATILE_KEYS } from './deep-diff.mjs';

test('ignores volatile keys', () => {
  const a = { serverTime: 123, nick: 'P' };
  const b = { serverTime: 456, nick: 'P' };
  const d = diffValues(a, b, new Set([...VOLATILE_KEYS, 'serverTime']));
  assert.equal(d.same, true);
});

test('reports scalar mismatch path', () => {
  const a = { user: { _id: 1001, level: 50 } };
  const b = { user: { _id: 1001, level: 99 } };
  const d = diffValues(a, b, new Set());
  assert.equal(d.same, false);
  assert.deepEqual(d.mismatches[0].path, ['user', 'level']);
  assert.equal(d.mismatches[0].expected, 50);
  assert.equal(d.mismatches[0].got, 99);
});

test('missing key in got is a mismatch', () => {
  const d = diffValues({ a: 1, b: 2 }, { a: 1 }, new Set());
  assert.equal(d.same, false);
  assert.equal(d.mismatches[0].path.join('.'), 'b');
});
