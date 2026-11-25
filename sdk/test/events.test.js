import { test } from 'node:test';
import assert from 'node:assert/strict';
import { init } from '../src/index.js';

// Events (D-011, C-003): exposures, track, evaluation counts, batching and flush.
// fetch is stubbed and setTimeout is mocked, so sends and the 5 s timer are under test control.
// Buckets (bucket.test.js, sdk-roundtrip.test.js): reserve-button-color + a1b2c3d4 = 29,
// + ștefan-ăîâ = 55, + user-1 = 40; new-checkout + user-1 = 31.
const config = () => ({
  version: 7,
  flags: {
    'reserve-button-color': {
      type: 'multivariate',
      enabled: true,
      default: 'blue',
      rules: [{ attribute: 'plan', operator: 'equals', value: 'beta', serve: 'green' }],
      variants: [
        { value: 'blue', from: 0, to: 50 },
        { value: 'green', from: 50, to: 100 },
      ],
      experiment: true,
    },
    'new-checkout': {
      type: 'boolean',
      enabled: true,
      default: false,
      rules: [{ attribute: 'country', operator: 'in', values: ['RO', 'MD'], serve: true }],
      variants: [{ value: true, from: 0, to: 30 }],
      experiment: true,
    },
    'no-experiment': { type: 'multivariate', enabled: true, default: 'blue', rules: [], variants: [{ value: 'blue', from: 0, to: 100 }] },
    off: { type: 'multivariate', enabled: false, default: 'blue', rules: [], variants: [{ value: 'blue', from: 0, to: 100 }], experiment: true },
  },
});

const BASE = 'http://flags.test';

// A client with a base URL, mocked timers and (by default) a pagehide that goes nowhere.
function client(t, options = {}) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  return init({ sdkKey: 'sdk key/1', baseUrl: BASE, config: config(), ...options });
}

// Stubs fetch; `respond(call)` returns a Response (or a promise of one), or throws.
function stubFetch(t, respond = () => new Response(null, { status: 204 })) {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const call = { url, options, events: JSON.parse(options.body).events };
    calls.push(call);
    return respond(call);
  });
  return calls;
}

const status = (code) => new Response(null, { status: code });
const settle = () => new Promise((resolve) => setImmediate(resolve));
const strip = (events) => events.map(({ id, ...rest }) => rest);
const ids = (call) => call.events.map((e) => e.id);

function deferred() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}

// Captures the pagehide listener the client registers on the global object.
function capturePagehide(t) {
  const handlers = [];
  globalThis.addEventListener = (type, fn) => {
    if (type === 'pagehide') handlers.push(fn);
  };
  t.after(() => delete globalThis.addEventListener);
  return () => handlers.forEach((fn) => fn());
}

test('getVariant on an experiment flag queues one exposure per user and flag', async (t) => {
  const calls = stubFetch(t);
  const ff = client(t);
  ff.identify('a1b2c3d4');
  assert.equal(ff.getVariant('reserve-button-color'), 'blue');
  assert.equal(ff.getVariant('reserve-button-color'), 'blue');
  ff.identify('ștefan-ăîâ');
  assert.equal(ff.getVariant('reserve-button-color'), 'green');
  assert.equal(await ff.flush(), 'sent');
  assert.deepEqual(strip(calls[0].events), [
    { type: 'exposure', userId: 'a1b2c3d4', flagKey: 'reserve-button-color', variant: 'blue' },
    { type: 'exposure', userId: 'ștefan-ăîâ', flagKey: 'reserve-button-color', variant: 'green' },
    { type: 'evaluations', counts: { 'reserve-button-color': 3 } },
  ]);
});

test('no exposure before identify, without experiment, when off, on a rule, on an uncovered bucket, or from isEnabled', async (t) => {
  const calls = stubFetch(t);
  const ff = client(t);
  ff.getVariant('reserve-button-color'); // before identify
  ff.identify('a1b2c3d4');
  ff.isEnabled('reserve-button-color'); // isEnabled never exposes
  ff.getVariant('no-experiment');
  ff.getVariant('off');
  ff.identify('user-1');
  ff.getVariant('new-checkout'); // bucket 31, range [0, 30): uncovered
  ff.identify('user-1', { country: 'RO', plan: 'beta' });
  assert.equal(ff.getVariant('new-checkout'), true); // rule
  assert.equal(ff.getVariant('reserve-button-color'), 'green'); // rule
  assert.equal(await ff.flush(), 'sent');
  assert.deepEqual(calls[0].events.filter((e) => e.type === 'exposure'), []);
});

test('track: a non-string metric throws TypeError; before identify it is ignored; after, it queues a conversion', async (t) => {
  const calls = stubFetch(t);
  const ff = client(t);
  assert.throws(() => ff.track(42), TypeError);
  ff.track('reserve_click');
  assert.equal(await ff.flush(), 'empty');
  ff.identify('u1');
  assert.throws(() => ff.track(null), TypeError);
  ff.track('reserve_click');
  assert.equal(await ff.flush(), 'sent');
  assert.equal(calls.length, 1);
  assert.deepEqual(strip(calls[0].events), [{ type: 'conversion', userId: 'u1', metric: 'reserve_click' }]);
});

test('reads of known flags are counted per flag and sent as one evaluations event at the end', async (t) => {
  const calls = stubFetch(t);
  const ff = client(t);
  ff.isEnabled('new-checkout');
  ff.getVariant('new-checkout');
  ff.getVariant('no-experiment');
  ff.getVariant('no-such-flag');
  ff.isEnabled('toString');
  ff.identify('u1');
  ff.track('reserve_click');
  assert.equal(await ff.flush(), 'sent');
  const { events } = calls[0];
  assert.deepEqual(strip(events), [
    { type: 'conversion', userId: 'u1', metric: 'reserve_click' },
    { type: 'evaluations', counts: { 'new-checkout': 2, 'no-experiment': 1 } },
  ]);
  assert.match(events[1].id, /^[0-9a-f]{32}$/);
  assert.equal(await ff.flush(), 'empty'); // the counts were reset
});

test('a queued event is sent 5 s after it was queued, not before', async (t) => {
  const calls = stubFetch(t);
  const ff = client(t);
  ff.identify('u1');
  ff.track('reserve_click');
  t.mock.timers.tick(4999);
  await settle();
  assert.equal(calls.length, 0);
  t.mock.timers.tick(1);
  await settle();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].events.length, 1);
});

test('20 queued events are sent at once; no request holds more than 20', async (t) => {
  const calls = stubFetch(t);
  const ff = client(t);
  ff.identify('u1');
  for (let i = 0; i < 25; i++) ff.track(`m${i}`);
  await settle();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].events.map((e) => e.metric), Array.from({ length: 20 }, (_, i) => `m${i}`));
  t.mock.timers.tick(5000);
  await settle();
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].events.map((e) => e.metric), ['m20', 'm21', 'm22', 'm23', 'm24']);
});

test('the request is a keepalive JSON POST to /sdk/events with the key URL-encoded', async (t) => {
  const calls = stubFetch(t);
  const ff = client(t);
  ff.identify('u1');
  ff.track('reserve_click');
  await ff.flush();
  const { url, options } = calls[0];
  assert.equal(url, `${BASE}/sdk/events?key=sdk%20key%2F1`);
  assert.equal(options.method, 'POST');
  assert.equal(options.keepalive, true);
  assert.equal(options.headers['Content-Type'], 'application/json');
  assert.deepEqual(Object.keys(JSON.parse(options.body)), ['events']);
});

test('only one request is in flight: neither 20 events nor the timer start a second one', async (t) => {
  const first = deferred();
  let n = 0;
  const calls = stubFetch(t, () => (n++ === 0 ? first.promise : status(204)));
  const ff = client(t);
  ff.identify('u1');
  for (let i = 0; i < 40; i++) ff.track(`m${i}`);
  await settle();
  t.mock.timers.tick(5000);
  await settle();
  assert.equal(calls.length, 1);
  first.resolve(status(204));
  await settle();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].events.length, 20);
  assert.equal(calls[1].events.some((e) => ids(calls[0]).includes(e.id)), false);
});

test('a 5xx or a network error keeps the events; they are resent with the same ids 5 s later', async (t) => {
  const responses = [() => status(500), () => { throw new TypeError('network'); }, () => status(204)];
  let n = 0;
  const calls = stubFetch(t, () => responses[n++]());
  const ff = client(t);
  ff.identify('u1');
  ff.track('reserve_click');
  assert.equal(await ff.flush(), 'error');
  t.mock.timers.tick(5000);
  await settle();
  assert.equal(calls.length, 2);
  t.mock.timers.tick(5000);
  await settle();
  assert.equal(calls.length, 3);
  assert.deepEqual(ids(calls[1]), ids(calls[0]));
  assert.deepEqual(ids(calls[2]), ids(calls[0]));
  assert.equal(await ff.flush(), 'empty');
});

test('a 4xx drops the events; they are never resent', async (t) => {
  const calls = stubFetch(t, () => status(400));
  const ff = client(t);
  ff.identify('u1');
  ff.track('reserve_click');
  assert.equal(await ff.flush(), 'dropped');
  t.mock.timers.tick(15000);
  await settle();
  assert.equal(calls.length, 1);
  assert.equal(await ff.flush(), 'empty');
});

test('flush waits for the request in flight, then sends the rest in chunks of 20', async (t) => {
  const first = deferred();
  let n = 0;
  const calls = stubFetch(t, () => (n++ === 0 ? first.promise : status(204)));
  const ff = client(t);
  assert.equal(await ff.flush(), 'empty');
  ff.identify('u1');
  for (let i = 0; i < 45; i++) ff.track(`m${i}`);
  await settle();
  const result = ff.flush();
  await settle();
  assert.equal(calls.length, 1);
  first.resolve(status(204));
  assert.equal(await result, 'sent');
  assert.deepEqual(calls.map((c) => c.events.length), [20, 20, 5]);
  assert.equal(await ff.flush(), 'empty');
});

test('flush never rejects, even when fetch throws synchronously', async (t) => {
  t.mock.method(globalThis, 'fetch', () => {
    throw new TypeError('sync');
  });
  const ff = client(t);
  ff.identify('u1');
  ff.track('reserve_click');
  assert.equal(await ff.flush(), 'error');
});

test('pagehide sends the whole queue at once, in-flight events included, with keepalive', async (t) => {
  const fire = capturePagehide(t);
  const first = deferred();
  let n = 0;
  const calls = stubFetch(t, () => (n++ === 0 ? first.promise : status(204)));
  const ff = client(t);
  ff.identify('u1');
  for (let i = 0; i < 22; i++) ff.track(`m${i}`);
  await settle();
  assert.equal(calls.length, 1); // m0..m19 in flight
  fire();
  assert.equal(calls.length, 3); // no wait for the request in flight
  assert.deepEqual(ids(calls[1]), ids(calls[0]));
  assert.deepEqual(calls[2].events.map((e) => e.metric), ['m20', 'm21']);
  assert.equal(calls.every((c) => c.options.keepalive === true), true);
  first.resolve(status(204));
  await settle();
  assert.equal(await ff.flush(), 'empty');
});

test('pagehide with an empty queue sends nothing', async (t) => {
  const fire = capturePagehide(t);
  const calls = stubFetch(t);
  client(t);
  fire();
  assert.equal(calls.length, 0);
});

test('event ids are 32 hex digits from crypto.getRandomValues, all distinct', async (t) => {
  const calls = stubFetch(t);
  const random = t.mock.method(globalThis.crypto, 'getRandomValues');
  const ff = client(t);
  ff.identify('u1');
  for (let i = 0; i < 5; i++) ff.track('reserve_click');
  await ff.flush();
  const all = ids(calls[0]);
  assert.equal(all.every((id) => /^[0-9a-f]{32}$/.test(id)), true);
  assert.equal(new Set(all).size, 5);
  assert.ok(random.mock.callCount() >= 5);
});

test('without baseUrl nothing is queued and flush gives empty', async (t) => {
  const calls = stubFetch(t);
  const ff = client(t, { baseUrl: undefined });
  ff.identify('a1b2c3d4');
  ff.getVariant('reserve-button-color');
  ff.track('reserve_click');
  assert.equal(await ff.flush(), 'empty');
  t.mock.timers.tick(10000);
  await settle();
  assert.equal(calls.length, 0);
});
