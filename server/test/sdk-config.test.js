import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { isValidConfig } from '../../sdk/src/validate.js';
import { migrate } from '../src/db.js';
import { testPool, reset, seed, listen, addFlagEnvironment, addExperiment } from './helpers.js';

// GET /sdk/config (C-002) against a real PostgreSQL (TEST_DATABASE_URL).
const pool = testPool();
let app;
before(async () => {
  await reset(pool);
  app = await listen(pool);
});
beforeEach(async () => {
  await reset(pool);
  await seed(pool);
});
after(async () => {
  await app?.close();
  await pool.end();
});

const get = (key, headers = {}) =>
  fetch(key === undefined ? `${app.baseUrl}/sdk/config` : `${app.baseUrl}/sdk/config?key=${encodeURIComponent(key)}`, { headers });

const projectADev = {
  version: 7,
  flags: {
    'new-checkout': {
      type: 'boolean',
      enabled: true,
      default: false,
      rules: [{ attribute: 'country', operator: 'in', values: ['RO', 'MD'], serve: true }],
      variants: [{ value: true, from: 0, to: 30 }],
    },
    'reserve-button-color': {
      type: 'multivariate',
      enabled: true,
      default: 'blue',
      rules: [{ attribute: 'plan', operator: 'equals', value: 'beta', serve: 'green' }],
      variants: [
        { value: 'blue', from: 0, to: 50 },
        { value: 'green', from: 50, to: 100 },
      ],
    },
  },
};

test('a valid key gets 200, ETag "<version>" and the environment configuration (C-001)', async () => {
  const res = await get('key-a-dev');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('etag'), '"7"');
  assert.match(res.headers.get('content-type'), /^application\/json/);
  const body = await res.json();
  assert.deepEqual(body, projectADev);
  assert.equal(isValidConfig(body), true);
});

test('only the key environment: other environments and projects are left out, and so is a flag without a row there', async () => {
  const res = await get('key-a-prod');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('etag'), '"3"');
  assert.deepEqual(await res.json(), {
    version: 3,
    flags: { 'new-checkout': { type: 'boolean', enabled: false, default: false, rules: [], variants: [] } },
  });
});

test('an environment with no flags serves an empty, valid configuration', async () => {
  await pool.query('DELETE FROM flag_environments WHERE environment_id = 3');
  const res = await get('key-b-dev');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body, { version: 1, flags: {} });
  assert.equal(isValidConfig(body), true);
});

test('If-None-Match equal to the current ETag gets 304 with no body', async () => {
  const res = await get('key-a-dev', { 'If-None-Match': '"7"' });
  assert.equal(res.status, 304);
  assert.equal(await res.text(), '');
});

test('an old If-None-Match after the version changes gets 200 with the new version', async () => {
  await pool.query('UPDATE environments SET config_version = 8 WHERE id = 1');
  const res = await get('key-a-dev', { 'If-None-Match': '"7"' });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('etag'), '"8"');
  assert.equal((await res.json()).version, 8);
});

test('a flag with an experiment in the key environment gets experiment: true; the others have no such field (C-001)', async () => {
  await addExperiment(pool, 2, 1, 'reserve_click'); // reserve-button-color, project A dev
  await addExperiment(pool, 1, 2, 'reserve_click'); // new-checkout, project A prod only
  const res = await get('key-a-dev');
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.flags['reserve-button-color'].experiment, true);
  assert.equal(Object.hasOwn(body.flags['new-checkout'], 'experiment'), false);
  assert.deepEqual(body, {
    ...projectADev,
    flags: { ...projectADev.flags, 'reserve-button-color': { ...projectADev.flags['reserve-button-color'], experiment: true } },
  });
  assert.equal(isValidConfig(body), true);
});

test('an unknown key gets 404; a missing key gets 400', async () => {
  assert.equal((await get('no-such-key')).status, 404);
  assert.equal((await get(undefined)).status, 400);
  assert.equal((await get('')).status, 400);
});

test('a key no environment can have (NUL) gets 404, not 500', async () => {
  const res = await get('k\u0000');
  assert.equal(res.status, 404);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
});

test('a stored configuration that fails C-001 gets 500 with no body', async (t) => {
  t.mock.method(console, 'error', () => {}); // the server logs it; keep the test output clean
  await pool.query('DELETE FROM flag_environments WHERE environment_id = 3');
  await addFlagEnvironment(pool, 3, 3, {
    enabled: true,
    default: false,
    rules: [],
    variants: [{ value: true, from: '0', to: 30 }],
  });
  const res = await get('key-b-dev');
  assert.equal(res.status, 500);
  assert.equal(await res.text(), '');
});

test('CORS: every response allows any origin and exposes ETag', async () => {
  for (const res of [await get('key-a-dev'), await get('key-a-dev', { 'If-None-Match': '"7"' }), await get('no-such-key')]) {
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
    assert.equal(res.headers.get('access-control-expose-headers'), 'ETag');
  }
});

test('CORS: the preflight gets 204 allowing GET and If-None-Match', async () => {
  const res = await fetch(`${app.baseUrl}/sdk/config?key=key-a-dev`, {
    method: 'OPTIONS',
    headers: { Origin: 'http://p1.example', 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'if-none-match' },
  });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  assert.equal(res.headers.get('access-control-allow-methods'), 'GET');
  assert.equal(res.headers.get('access-control-allow-headers'), 'If-None-Match');
});

test('migrate can run again on an existing schema', async () => {
  await migrate(pool);
  await migrate(pool);
  assert.equal((await get('key-a-dev')).status, 200);
});
