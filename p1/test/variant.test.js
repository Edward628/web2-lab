import { test } from 'node:test';
import assert from 'node:assert/strict';
import { firstVariant } from '../src/variant.js';

const settle = () => new Promise((r) => setImmediate(r));

// A stand-in SDK client: refresh() resolves when the test calls answer().
function fakeClient(value) {
  let answer;
  const reads = [];
  const ff = {
    refresh: () => new Promise((r) => (answer = r)),
    getVariant: (key) => {
      reads.push(key);
      return value;
    },
  };
  return { ff, reads, answer: (r = 'updated') => answer(r) };
}

test('a refresh within 5 s reads the variant once', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const c = fakeClient('green');
  const p = firstVariant(c.ff, 'reserve-button-color');
  t.mock.timers.tick(4999);
  c.answer();
  assert.equal(await p, 'green');
  assert.deepEqual(c.reads, ['reserve-button-color']);
});

test('a failed refresh still reads the variant (the SDK falls back to the control)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const c = fakeClient(null);
  const p = firstVariant(c.ff, 'reserve-button-color');
  c.answer('error');
  assert.equal(await p, 'blue');
  assert.deepEqual(c.reads, ['reserve-button-color']);
});

test('no answer in 5 s: the control, without reading the variant (no exposure)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const c = fakeClient('green');
  let result;
  firstVariant(c.ff, 'reserve-button-color').then((r) => (result = r));
  t.mock.timers.tick(4999);
  await settle();
  assert.equal(result, undefined);
  t.mock.timers.tick(1);
  await settle();
  assert.equal(result, 'blue');
  assert.deepEqual(c.reads, []);
});

test('a config that arrives after the 5 s is not read on this page load', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const c = fakeClient('green');
  const p = firstVariant(c.ff, 'reserve-button-color');
  t.mock.timers.tick(5000);
  assert.equal(await p, 'blue');
  c.answer();
  await settle();
  assert.deepEqual(c.reads, []);
});
