import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { testPool, reset, seed, listen, addExperiment } from './helpers.js';

// POST /sdk/events (C-003, D-005) against a real PostgreSQL (TEST_DATABASE_URL).
// Fixtures (helpers.js): environments 1 = A dev (key-a-dev), 2 = A prod (key-a-prod),
// 3 = B dev (key-b-dev); flags 1 = new-checkout, 2 = reserve-button-color, 3 = other-project-flag.
// Experiments added here: 1 = reserve-button-color in A dev (reserve_click),
// 2 = new-checkout in A dev (checkout_done), 3 = new-checkout in A prod (reserve_click).
const pool = testPool();
let app;
before(async () => {
  await reset(pool);
  app = await listen(pool);
});
beforeEach(async () => {
  await reset(pool);
  await seed(pool);
  await addExperiment(pool, 2, 1, 'reserve_click');
  await addExperiment(pool, 1, 1, 'checkout_done');
  await addExperiment(pool, 1, 2, 'reserve_click');
});
after(async () => {
  await app?.close();
  await pool.end();
});

const post = (key, body, headers = { 'Content-Type': 'application/json' }) =>
  fetch(key === undefined ? `${app.baseUrl}/sdk/events` : `${app.baseUrl}/sdk/events?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

const send = async (key, events) => {
  const res = await post(key, { events });
  assert.equal(res.status, 204);
  assert.equal(await res.text(), '');
};

const exposure = (id, userId, flagKey, variant) => ({ id, type: 'exposure', userId, flagKey, variant });
const conversion = (id, userId, metric) => ({ id, type: 'conversion', userId, metric });

const rows = async (table) =>
  (await pool.query(`SELECT experiment_id, user_id${table === 'exposures' ? ', variant' : ''} FROM ${table} ORDER BY experiment_id, user_id`)).rows;
const count = async (table) => (await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;
const lastEvaluated = async () =>
  (await pool.query('SELECT flag_id, environment_id, last_evaluated_at FROM flag_environments ORDER BY flag_id, environment_id')).rows;

test('a valid batch gets 204; an exposure counts once per user and experiment, the first variant is kept', async () => {
  await send('key-a-dev', [
    exposure('e1', 'u1', 'reserve-button-color', 'blue'),
    exposure('e2', 'u1', 'reserve-button-color', 'green'),
    exposure('e3', 'u2', 'reserve-button-color', 'green'),
  ]);
  await send('key-a-dev', [exposure('e4', 'u1', 'reserve-button-color', 'green')]);
  assert.deepEqual(await rows('exposures'), [
    { experiment_id: 1, user_id: 'u1', variant: 'blue' },
    { experiment_id: 1, user_id: 'u2', variant: 'green' },
  ]);
});

test('a conversion before any exposure is not counted; after the exposure it counts once per user', async () => {
  await send('key-a-dev', [conversion('c1', 'u1', 'reserve_click')]);
  assert.deepEqual(await rows('conversions'), []);
  await send('key-a-dev', [exposure('e1', 'u1', 'reserve-button-color', 'blue')]);
  await send('key-a-dev', [conversion('c2', 'u1', 'reserve_click')]);
  await send('key-a-dev', [conversion('c3', 'u1', 'reserve_click')]);
  assert.deepEqual(await rows('conversions'), [{ experiment_id: 1, user_id: 'u1' }]);
});

test('in one batch, events are taken in order: exposure then conversion counts, conversion then exposure does not', async () => {
  await send('key-a-dev', [exposure('e1', 'u1', 'reserve-button-color', 'blue'), conversion('c1', 'u1', 'reserve_click')]);
  await send('key-a-dev', [conversion('c2', 'u2', 'reserve_click'), exposure('e2', 'u2', 'reserve-button-color', 'green')]);
  assert.deepEqual(await rows('conversions'), [{ experiment_id: 1, user_id: 'u1' }]);
  assert.equal(await count('exposures'), 2);
});

test('idempotent by event id: a seen id is ignored, even when it would count now; a resent batch changes nothing', async () => {
  await send('key-a-dev', [conversion('c1', 'u1', 'reserve_click')]); // dropped: no exposure yet
  await send('key-a-dev', [exposure('e1', 'u1', 'reserve-button-color', 'blue')]);
  await send('key-a-dev', [conversion('c1', 'u1', 'reserve_click')]); // same id: ignored
  assert.deepEqual(await rows('conversions'), []);

  const batch = [exposure('e2', 'u2', 'reserve-button-color', 'green'), conversion('c2', 'u2', 'reserve_click')];
  await send('key-a-dev', batch);
  const before = { exposures: await rows('exposures'), conversions: await rows('conversions'), ids: await count('ingested_events') };
  await send('key-a-dev', batch);
  assert.deepEqual({ exposures: await rows('exposures'), conversions: await rows('conversions'), ids: await count('ingested_events') }, before);
  assert.equal(before.ids, 4);
});

test('event ids are per environment: the same id in another environment is a new event', async () => {
  await send('key-a-dev', [exposure('same', 'u1', 'reserve-button-color', 'blue')]);
  await send('key-a-prod', [exposure('same', 'u1', 'new-checkout', true)]);
  assert.deepEqual(await rows('exposures'), [
    { experiment_id: 1, user_id: 'u1', variant: 'blue' },
    { experiment_id: 3, user_id: 'u1', variant: true },
  ]);
});

test('a conversion counts only in the experiments of the key environment whose metric matches', async () => {
  await send('key-a-dev', [exposure('e1', 'u1', 'reserve-button-color', 'blue'), exposure('e2', 'u1', 'new-checkout', true)]);
  await send('key-a-prod', [exposure('e3', 'u1', 'new-checkout', true)]);
  await send('key-a-dev', [conversion('c1', 'u1', 'reserve_click')]);
  assert.deepEqual(await rows('conversions'), [{ experiment_id: 1, user_id: 'u1' }]);
});

test('an unknown flag, a flag without an experiment and an unused metric are accepted and ignored', async () => {
  await send('key-a-dev', [
    exposure('e1', 'u1', 'no-such-flag', 'blue'),
    exposure('e2', 'u1', 'other-project-flag', true), // project B's flag, not in A dev
    conversion('c1', 'u1', 'no_such_metric'),
  ]);
  await send('key-b-dev', [exposure('e3', 'u1', 'other-project-flag', true)]); // no experiment in B dev
  assert.equal(await count('exposures'), 0);
  assert.equal(await count('conversions'), 0);
});

test('evaluations set last_evaluated_at only on the flags of the key environment; unknown flags are ignored', async () => {
  const t0 = Date.now();
  await send('key-a-dev', [{ id: 'v1', type: 'evaluations', counts: { 'new-checkout': 3, 'other-project-flag': 1, 'no-such-flag': 2 } }]);
  const after = await lastEvaluated();
  const at = (flagId, envId) => after.find((r) => r.flag_id === flagId && r.environment_id === envId).last_evaluated_at;
  assert.ok(at(1, 1) instanceof Date);
  assert.ok(at(1, 1).getTime() >= t0 - 5000 && at(1, 1).getTime() <= Date.now() + 5000);
  assert.equal(at(2, 1), null); // reserve-button-color: not in the counts
  assert.equal(at(1, 2), null); // new-checkout in A prod: another environment
  assert.equal(at(3, 3), null); // other-project-flag lives in B dev
});

test('a malformed batch gets 400 and nothing is stored, even its valid events', async () => {
  const valid = exposure('ok', 'u1', 'reserve-button-color', 'blue');
  const bad = [
    'not json {',
    [],
    {},
    { events: [] },
    { events: 'x' },
    { events: [valid, null] },
    { events: [valid, { type: 'exposure', userId: 'u1', flagKey: 'f', variant: 1 }] }, // no id
    { events: [valid, exposure('', 'u1', 'f', 1)] }, // empty id
    { events: [valid, exposure('x'.repeat(65), 'u1', 'f', 1)] }, // id too long
    { events: [valid, exposure(7, 'u1', 'f', 1)] }, // id not a string
    { events: [valid, { id: 'x', type: 'click', userId: 'u1' }] }, // unknown type
    { events: [valid, exposure('x', 1, 'f', 1)] }, // userId not a string
    { events: [valid, exposure('x', 'u1', 1, 1)] }, // flagKey not a string
    { events: [valid, { id: 'x', type: 'exposure', userId: 'u1', flagKey: 'f' }] }, // no variant
    { events: [valid, conversion('x', 'u1', 5)] }, // metric not a string
    { events: [valid, { id: 'x', type: 'evaluations', counts: [] }] },
    { events: [valid, { id: 'x', type: 'evaluations', counts: { f: 0 } }] },
    { events: [valid, { id: 'x', type: 'evaluations', counts: { f: 1.5 } }] },
    { events: [valid, { id: 'x', type: 'evaluations', counts: { f: '2' } }] },
  ];
  for (const body of bad) {
    const res = await post('key-a-dev', body);
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
  }
  assert.equal(await count('exposures'), 0);
  assert.equal(await count('ingested_events'), 0);
});

test('text PostgreSQL cannot store gets 400, not 500: NUL anywhere, a lone surrogate anywhere (review S1, S2)', async () => {
  const valid = exposure('ok', 'u1', 'reserve-button-color', 'blue');
  const bad = [
    conversion('a\u0000', 'u1', 'reserve_click'),
    conversion('c', 'u\u0000', 'reserve_click'),
    conversion('c', 'u1', 'reserve\u0000click'),
    exposure('e', 'u1', 'reserve-button-color\u0000', 'blue'),
    exposure('e', 'u1', 'reserve-button-color', '\u0000'),
    exposure('e', 'u1', 'reserve-button-color', { nested: ['ok', 'a\u0000'] }),
    exposure('e', 'u1', 'reserve-button-color', { ['k\u0000']: 1 }),
    { id: 'v', type: 'evaluations', counts: { ['new-checkout\u0000']: 1 } },
    conversion('x\ud800', 'u1', 'reserve_click'),
    conversion('c', 'u\udc00', 'reserve_click'),
    exposure('e', 'u1', 'reserve-button-color', '\ud800'),
    exposure('e', 'u1', 'reserve-button-color', { ['k\udfff']: 1 }),
    { id: 'v', type: 'evaluations', counts: { ['f\ud800']: 1 } },
  ];
  for (const event of bad) {
    // JSON.stringify writes lone surrogates as \uXXXX escapes, so they reach the server as such.
    const res = await post('key-a-dev', { events: [valid, event] });
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(event)}`);
    assert.equal(await res.text(), '');
  }
  assert.equal(await count('ingested_events'), 0);
});

test('two ids that differ only in lone surrogates are not merged into one event (review S2)', async () => {
  const res = await post(
    'key-a-dev',
    '{"events":[{"id":"x\\ud800","type":"exposure","userId":"s1","flagKey":"reserve-button-color","variant":"blue"},' +
      '{"id":"x\\udc00","type":"exposure","userId":"s2","flagKey":"reserve-button-color","variant":"blue"}]}',
  );
  assert.equal(res.status, 400);
  assert.equal(await count('ingested_events'), 0);
});

test('userId, flagKey, metric and counts keys longer than 256 characters get 400; 256 is accepted (review S3)', async () => {
  const long = 'x'.repeat(257);
  const cjk = '一'.repeat(257); // 3 bytes each in UTF-8: past the btree limit when stored
  const valid = exposure('ok', 'u1', 'reserve-button-color', 'blue');
  for (const event of [
    exposure('e', long, 'reserve-button-color', 'blue'),
    exposure('e', cjk, 'reserve-button-color', 'blue'),
    exposure('e', 'u1', long, 'blue'),
    conversion('c', long, 'reserve_click'),
    conversion('c', 'u1', long),
    { id: 'v', type: 'evaluations', counts: { [long]: 1 } },
  ]) {
    const res = await post('key-a-dev', { events: [valid, event] });
    assert.equal(res.status, 400, `expected 400 for ${JSON.stringify(event).slice(0, 80)}`);
  }
  assert.equal(await count('ingested_events'), 0);

  const atLimit = '一'.repeat(256);
  await send('key-a-dev', [exposure('e1', atLimit, 'reserve-button-color', 'blue'), conversion('c1', atLimit, 'reserve_click')]);
  assert.equal(await count('conversions'), 1);
});

test('a key no environment can have (NUL) gets 404, not 500', async () => {
  const res = await post('k\u0000', { events: [exposure('e1', 'u1', 'reserve-button-color', 'blue')] });
  assert.equal(res.status, 404);
});

test('a body the JSON parser refuses for its charset or encoding gets 400 with no body, not 415 (review S4)', async () => {
  const body = JSON.stringify({ events: [exposure('e1', 'u1', 'reserve-button-color', 'blue')] });
  for (const headers of [
    { 'Content-Type': 'application/json; charset=latin1' },
    { 'Content-Type': 'application/json', 'Content-Encoding': 'compress' },
  ]) {
    const res = await post('key-a-dev', body, headers);
    assert.equal(res.status, 400, JSON.stringify(headers));
    assert.equal(await res.text(), '');
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
  }
  assert.equal(await count('ingested_events'), 0);
});

test('a missing key gets 400; an unknown key gets 404; nothing is stored', async () => {
  const body = { events: [exposure('e1', 'u1', 'reserve-button-color', 'blue')] };
  assert.equal((await post(undefined, body)).status, 400);
  assert.equal((await post('', body)).status, 400);
  assert.equal((await post('no-such-key', body)).status, 404);
  assert.equal(await count('ingested_events'), 0);
});

test('a body over 100 kB gets 413', async () => {
  const res = await post('key-a-dev', { events: [exposure('e1', 'u1', 'reserve-button-color', 'x'.repeat(110 * 1024))] });
  assert.equal(res.status, 413);
  assert.equal(await count('ingested_events'), 0);
});

test('CORS: every response allows any origin', async () => {
  for (const res of [
    await post('key-a-dev', { events: [exposure('e1', 'u1', 'reserve-button-color', 'blue')] }),
    await post('key-a-dev', { events: [] }),
    await post('no-such-key', { events: [exposure('e2', 'u1', 'reserve-button-color', 'blue')] }),
  ]) {
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
  }
});

test('CORS: the preflight gets 204 allowing POST and Content-Type', async () => {
  const res = await fetch(`${app.baseUrl}/sdk/events?key=key-a-dev`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://p1.example', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type' },
  });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  assert.equal(res.headers.get('access-control-allow-methods'), 'POST');
  assert.equal(res.headers.get('access-control-allow-headers'), 'Content-Type');
});
