import { test } from 'node:test';
import assert from 'node:assert/strict';
import { init } from '../src/index.js';

// Live updates (D-018, C-006): connect() listens on the stream, refreshes on a newer
// version, reconnects after 3 s, falls back to polling every 30 s after 3 failures in a
// row, and status() turns 'stale' 60 s after the last confirmation.
// EventSource is a fake on globalThis; fetch is stubbed; setTimeout and Date are mocked (PATTERN-005).
const BASE = 'http://flags.test';
const STREAM = `${BASE}/sdk/stream?key=sdk%20key%2F1`;
const CONFIG = `${BASE}/sdk/config?key=sdk%20key%2F1`;

const configV = (version) => ({
  version,
  flags: { 'new-checkout': { type: 'boolean', enabled: true, default: false, rules: [], variants: [{ value: true, from: 0, to: 100 }] } },
});

// Installs a fake EventSource class; returns the instances it creates, in order.
function fakeEventSource(t) {
  const instances = [];
  class FakeEventSource {
    constructor(url) {
      this.url = url;
      this.closed = false;
      this.listeners = {};
      instances.push(this);
    }
    addEventListener(type, fn) {
      (this.listeners[type] ??= []).push(fn);
    }
    close() {
      this.closed = true;
    }
    emit(type, data) {
      for (const fn of this.listeners[type] ?? []) fn({ type, data });
    }
  }
  globalThis.EventSource = FakeEventSource;
  t.after(() => delete globalThis.EventSource);
  return instances;
}

// Stubs fetch: config GETs are recorded and answered by `respond(call)`; event POSTs get 204.
function stubFetch(t, respond = () => new Response(JSON.stringify(configV(8)), { status: 200, headers: { ETag: '"8"' } })) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options = {}) => {
    if (options.method === 'POST') return new Response(null, { status: 204 });
    const call = { url, ifNoneMatch: options.headers?.['If-None-Match'] };
    calls.push(call);
    return respond(call);
  });
  return calls;
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

function client(t, options = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  return init({ sdkKey: 'sdk key/1', baseUrl: BASE, storage: null, ...options });
}

test('connect() opens one stream on /sdk/stream with the key URL-encoded; twice is still one', (t) => {
  const sources = fakeEventSource(t);
  stubFetch(t);
  const ff = client(t);
  ff.connect();
  ff.connect();
  assert.equal(sources.length, 1);
  assert.equal(sources[0].url, STREAM);
  ff.close();
});

test('connect() without a baseUrl does nothing', (t) => {
  const sources = fakeEventSource(t);
  const calls = stubFetch(t);
  const ff = client(t, { baseUrl: undefined });
  ff.connect();
  t.mock.timers.tick(60000);
  assert.equal(sources.length, 0);
  assert.equal(calls.length, 0);
});

test('a newer version refreshes once; the same version or non-integer data does not', async (t) => {
  const sources = fakeEventSource(t);
  const calls = stubFetch(t);
  const ff = client(t, { config: configV(7) });
  ff.connect();
  sources[0].emit('version', '7');
  sources[0].emit('version', 'x');
  sources[0].emit('version', '');
  sources[0].emit('version', '7.5');
  await settle();
  assert.equal(calls.length, 0);
  sources[0].emit('version', '8');
  await settle();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, CONFIG);
  sources[0].emit('version', '8'); // now current
  await settle();
  assert.equal(calls.length, 1);
  ff.close();
});

test('any version refreshes when there is no configuration yet', async (t) => {
  const sources = fakeEventSource(t);
  const calls = stubFetch(t);
  const ff = client(t);
  ff.identify('user-1');
  ff.connect();
  sources[0].emit('version', '8');
  await settle();
  assert.equal(calls.length, 1);
  assert.equal(ff.isEnabled('new-checkout'), true);
  ff.close();
});

test('after an error the stream is closed and reopened 3 s later; an open resets the count', (t) => {
  const sources = fakeEventSource(t);
  stubFetch(t);
  const ff = client(t);
  ff.connect();
  sources[0].emit('error');
  assert.equal(sources[0].closed, true);
  t.mock.timers.tick(2999);
  assert.equal(sources.length, 1);
  t.mock.timers.tick(1);
  assert.equal(sources.length, 2);
  sources[1].emit('error');
  t.mock.timers.tick(3000);
  sources[2].emit('open'); // two failures, then a success: the count starts over
  sources[2].emit('error');
  t.mock.timers.tick(3000);
  sources[3].emit('error');
  t.mock.timers.tick(3000);
  assert.equal(sources.length, 5); // still on SSE
  ff.close();
});

test('3 failures in a row switch to polling: refresh at once, then every 30 s, with If-None-Match', async (t) => {
  const sources = fakeEventSource(t);
  let n = 0;
  const calls = stubFetch(t, () =>
    n++ === 0 ? new Response(JSON.stringify(configV(8)), { status: 200, headers: { ETag: '"8"' } }) : new Response(null, { status: 304 }),
  );
  const ff = client(t);
  ff.connect();
  sources[0].emit('error');
  t.mock.timers.tick(3000);
  sources[1].emit('error');
  t.mock.timers.tick(3000);
  assert.equal(calls.length, 0);
  sources[2].emit('error');
  await settle();
  assert.equal(sources[2].closed, true);
  assert.equal(calls.length, 1); // right away
  t.mock.timers.tick(29999);
  await settle();
  assert.equal(calls.length, 1);
  t.mock.timers.tick(1);
  await settle();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].ifNoneMatch, '"8"');
  t.mock.timers.tick(30000);
  await settle();
  assert.equal(calls.length, 3);
  t.mock.timers.tick(300000);
  await settle();
  assert.equal(sources.length, 3); // never back to SSE
  ff.close();
});

test('without a global EventSource connect() polls right away', async (t) => {
  delete globalThis.EventSource;
  const calls = stubFetch(t);
  const ff = client(t);
  ff.connect();
  await settle();
  assert.equal(calls.length, 1);
  t.mock.timers.tick(30000);
  await settle();
  assert.equal(calls.length, 2);
  ff.close();
});

test('status() is ok at init and stale 60 s after it, with nothing to confirm', (t) => {
  const ff = client(t);
  assert.equal(ff.status(), 'ok');
  t.mock.timers.tick(59999);
  assert.equal(ff.status(), 'ok');
  t.mock.timers.tick(1);
  assert.equal(ff.status(), 'stale');
});

test('open and version messages confirm; the 60 s start over from each', async (t) => {
  const sources = fakeEventSource(t);
  stubFetch(t);
  const ff = client(t, { config: configV(8) });
  ff.connect();
  t.mock.timers.tick(50000);
  sources[0].emit('open');
  t.mock.timers.tick(50000);
  assert.equal(ff.status(), 'ok');
  sources[0].emit('version', '8');
  t.mock.timers.tick(59999);
  assert.equal(ff.status(), 'ok');
  t.mock.timers.tick(1);
  assert.equal(ff.status(), 'stale');
  sources[0].emit('version', '8');
  assert.equal(ff.status(), 'ok');
  ff.close();
});

test('a refresh with updated or not-modified confirms; error and rejected do not', async (t) => {
  const responses = [
    () => new Response(JSON.stringify(configV(8)), { status: 200, headers: { ETag: '"8"' } }),
    () => new Response(null, { status: 304 }),
    () => new Response(null, { status: 500 }),
    () => new Response('{"version": "bad"}', { status: 200 }),
  ];
  let n = 0;
  stubFetch(t, () => responses[n++]());
  const ff = client(t);
  t.mock.timers.tick(50000);
  assert.equal(await ff.refresh(), 'updated');
  t.mock.timers.tick(50000);
  assert.equal(await ff.refresh(), 'not-modified');
  t.mock.timers.tick(50000);
  assert.equal(await ff.refresh(), 'error');
  assert.equal(await ff.refresh(), 'rejected');
  assert.equal(ff.status(), 'ok');
  t.mock.timers.tick(10000);
  assert.equal(ff.status(), 'stale');
});

test('close() stops the stream, a pending reconnect and polling', async (t) => {
  const sources = fakeEventSource(t);
  const calls = stubFetch(t);
  const ff = client(t);
  ff.connect();
  sources[0].emit('error');
  ff.close(); // during the 3 s wait
  t.mock.timers.tick(3000);
  assert.equal(sources.length, 1);

  ff.connect(); // after close, connect works again, with the count reset
  assert.equal(sources.length, 2);
  ff.close();
  assert.equal(sources[1].closed, true);
  sources[1].emit('version', '9'); // a late message from a closed stream is ignored
  await settle();
  assert.equal(calls.length, 0);

  delete globalThis.EventSource;
  ff.connect();
  await settle();
  assert.equal(calls.length, 1);
  ff.close();
  t.mock.timers.tick(60000);
  await settle();
  assert.equal(calls.length, 1);
});
