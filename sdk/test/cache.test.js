import { test } from 'node:test';
import assert from 'node:assert/strict';
import { init } from '../src/index.js';

// The configuration cache (D-018, D-003): the last valid configuration and its ETag
// are kept in storage under ff:config:<sdkKey> and loaded at init, for offline use.
// Storage is passed in (PATTERN-006); fetch is stubbed.
const BASE = 'http://flags.test';
const KEY = 'ff:config:sdk key/1';

const configV = (version, to) => ({
  version,
  flags: { 'new-checkout': { type: 'boolean', enabled: true, default: false, rules: [], variants: [{ value: true, from: 0, to }] } },
});

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
}

function blockedStorage() {
  const fail = () => {
    throw new Error('SecurityError: storage is blocked');
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

// Stubs fetch for config GETs; `respond(call)` returns a Response.
function stubFetch(t, respond) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    if (options.method === 'POST') return new Response(null, { status: 204 });
    const call = { url, ifNoneMatch: options.headers?.['If-None-Match'] };
    calls.push(call);
    return respond(call);
  });
  return calls;
}

const ok = (config, etag) => new Response(JSON.stringify(config), { status: 200, headers: { ETag: etag } });

test('an updated configuration is saved with its ETag; a new client starts from it', async (t) => {
  const storage = memoryStorage();
  let n = 0;
  const calls = stubFetch(t, () => (n++ === 0 ? ok(configV(7, 100), '"7"') : new Response(null, { status: 304 })));
  const first = init({ sdkKey: 'sdk key/1', baseUrl: BASE, storage });
  assert.equal(await first.refresh(), 'updated');
  assert.deepEqual(JSON.parse(storage.data.get(KEY)), { etag: '"7"', config: configV(7, 100) });

  const second = init({ sdkKey: 'sdk key/1', baseUrl: BASE, storage });
  second.identify('user-1');
  assert.equal(second.isEnabled('new-checkout'), true); // before any request
  assert.equal(calls.length, 1);
  assert.equal(await second.refresh(), 'not-modified');
  assert.equal(calls[1].ifNoneMatch, '"7"');
});

test('a not-modified or failed refresh leaves the cache as it was', async (t) => {
  const saved = JSON.stringify({ etag: '"7"', config: configV(7, 100) });
  const storage = memoryStorage({ [KEY]: saved });
  const responses = [new Response(null, { status: 304 }), new Response(null, { status: 500 }), new Response('{', { status: 200 })];
  let n = 0;
  stubFetch(t, () => responses[n++]);
  const ff = init({ sdkKey: 'sdk key/1', baseUrl: BASE, storage });
  assert.equal(await ff.refresh(), 'not-modified');
  assert.equal(await ff.refresh(), 'error');
  assert.equal(await ff.refresh(), 'rejected');
  assert.equal(storage.data.get(KEY), saved);
});

test('the cache is per SDK key', async (t) => {
  const storage = memoryStorage({ [KEY]: JSON.stringify({ etag: '"7"', config: configV(7, 100) }) });
  const ff = init({ sdkKey: 'other-key', baseUrl: BASE, storage });
  ff.identify('user-1');
  assert.equal(ff.isEnabled('new-checkout'), false);
});

test('an invalid or non-JSON cache is ignored', async (t) => {
  for (const raw of ['not json {', 'null', '"text"', JSON.stringify({ etag: '"7"', config: { version: 7 } }), JSON.stringify({ etag: 7, config: configV(7, 100) })]) {
    const calls = [];
    t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
      calls.push(options.headers?.['If-None-Match']);
      return new Response(null, { status: 500 });
    });
    const ff = init({ sdkKey: 'sdk key/1', baseUrl: BASE, storage: memoryStorage({ [KEY]: raw }) });
    ff.identify('user-1');
    assert.equal(ff.isEnabled('new-checkout'), false, raw);
    await ff.refresh();
    assert.equal(calls[0], undefined, raw); // no ETag taken from a rejected cache
    t.mock.restoreAll();
  }
});

test('a config given to init wins over the cache', () => {
  const storage = memoryStorage({ [KEY]: JSON.stringify({ etag: '"7"', config: configV(7, 100) }) });
  const ff = init({ sdkKey: 'sdk key/1', baseUrl: BASE, storage, config: configV(3, 0) });
  ff.identify('user-1');
  assert.equal(ff.isEnabled('new-checkout'), false);
});

test('blocked storage throws nowhere; the SDK works without a cache', async (t) => {
  stubFetch(t, () => ok(configV(7, 100), '"7"'));
  const ff = init({ sdkKey: 'sdk key/1', baseUrl: BASE, storage: blockedStorage() });
  ff.identify('user-1');
  assert.equal(await ff.refresh(), 'updated');
  assert.equal(ff.isEnabled('new-checkout'), true);
});

test('storage: null means no cache', async (t) => {
  stubFetch(t, () => ok(configV(7, 100), '"7"'));
  const ff = init({ sdkKey: 'sdk key/1', baseUrl: BASE, storage: null });
  assert.equal(await ff.refresh(), 'updated');
});

test('a configuration from the cache does not confirm: stale after 60 s', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 0 });
  const storage = memoryStorage({ [KEY]: JSON.stringify({ etag: '"7"', config: configV(7, 100) }) });
  const ff = init({ sdkKey: 'sdk key/1', baseUrl: BASE, storage });
  assert.equal(ff.status(), 'ok');
  t.mock.timers.tick(60000);
  assert.equal(ff.status(), 'stale');
});
