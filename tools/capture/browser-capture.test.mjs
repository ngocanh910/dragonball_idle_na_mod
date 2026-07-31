import test from 'node:test';
import assert from 'node:assert/strict';
import { correlate } from './browser-capture.mjs';

test('correlate pairs emit to ack by ackId', () => {
  const frames = [
    { ts: 1, dir: 'emit', name: 'handler.process', ackId: 12, data: { type: 'hero', action: 'getAttrs' } },
    { ts: 2, dir: 'ack', ackId: 12, data: { ret: 0, data: '{}' } },
  ];
  const out = correlate(frames);
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, 'exchange');
  assert.equal(out[0].type, 'hero');
  assert.equal(out[0].action, 'getAttrs');
  assert.equal(out[0].res.ret, 0);
});

test('Notify frames become notify lines', () => {
  const frames = [{ ts: 3, dir: 'emit', name: 'Notify', data: { type: 'activity' } }];
  const out = correlate(frames);
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, 'notify');
});

test('server-pushed Notify (framereceived, dir ack) is not dropped', () => {
  const frames = [
    { ts: 4, dir: 'emit', name: 'handler.process', ackId: 7, data: { type: 'player', action: 'login' } },
    { ts: 5, dir: 'ack', ackId: 7, data: { ret: 0 } },
    { ts: 6, dir: 'ack', name: 'Notify', data: { type: 'reward' } },
  ];
  const out = correlate(frames);
  assert.equal(out.length, 2);
  assert.equal(out[1].kind, 'notify');
  assert.equal(out[1].type, 'reward');
});
