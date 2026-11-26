import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword } from '../src/admin.js';
import { testPool, reset, seed, listen } from './helpers.js';

// The admin flag API (C-007): list per environment, the switch (kill switch, D-004) and
// rollout on boolean flags; each real change is one transaction with the config_version
// bump and an audit row (D-010, D-020). Fixtures: helpers.js (project A: dev v7, prod v3).
const PASSWORD = 'test-only password';
const pool = testPool();
let app;
let cookie;
before(async () => {
  await reset(pool);
  app = await listen(pool, { adminPasswordHash: await hashPassword(PASSWORD) });
});
beforeEach(async () => {
  await reset(pool);
  await seed(pool);
  const res = await fetch(`${app.baseUrl}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: PASSWORD }),
  });
  assert.equal(res.status, 204);
  cookie = res.headers.get('set-cookie').split(';')[0];
});
after(async () => {
  await app?.close();
  await pool.end();
});

const list = (env) => fetch(`${app.baseUrl}/admin/flags${env === undefined ? '' : `?env=${env}`}`, { headers: { Cookie: cookie } });
const patch = (key, env, body, contentType = 'application/json') =>
  fetch(`${app.baseUrl}/admin/flags/${encodeURIComponent(key)}?env=${env}`, {
    method: 'PATCH',
    headers: { Cookie: cookie, 'Content-Type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const version = async (environmentId) =>
  (await pool.query('SELECT config_version FROM environments WHERE id = $1', [environmentId])).rows[0].config_version;
const flagRow = async (flagId, environmentId) =>
  (await pool.query('SELECT enabled, "default", rules, variants FROM flag_environments WHERE flag_id = $1 AND environment_id = $2', [flagId, environmentId])).rows[0];
const audit = async () =>
  (await pool.query('SELECT environment_id, flag_id, action, before, after, config_version FROM audit_log ORDER BY id')).rows;
const sdkConfig = (key) => fetch(`${app.baseUrl}/sdk/config?key=${key}`);

const newCheckoutDev = {
  key: 'new-checkout',
  type: 'boolean',
  enabled: true,
  default: false,
  ruleCount: 1,
  variants: [{ value: true, from: 0, to: 30 }],
  rollout: 30,
};
const reserveDev = {
  key: 'reserve-button-color',
  type: 'multivariate',
  enabled: true,
  default: 'blue',
  ruleCount: 1,
  variants: [
    { value: 'blue', from: 0, to: 50 },
    { value: 'green', from: 50, to: 100 },
  ],
  rollout: null,
};

// --- list -------------------------------------------------------------------------

test('GET /admin/flags lists the open project flags of that environment, by key, with the version', async () => {
  const res = await list('dev');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^application\/json/);
  assert.deepEqual(await res.json(), {
    project: { id: 1, name: 'A' },
    environment: 'dev',
    version: 7,
    flags: [newCheckoutDev, reserveDev],
  });
});

test('prod lists only the flags with a row in prod; a boolean flag with no variants has rollout 0', async () => {
  const res = await list('prod');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    project: { id: 1, name: 'A' },
    environment: 'prod',
    version: 3,
    flags: [{ key: 'new-checkout', type: 'boolean', enabled: false, default: false, ruleCount: 0, variants: [], rollout: 0 }],
  });
});

test('rollout is null on a boolean flag whose variants are not one true range from 0', async () => {
  await pool.query(`UPDATE flag_environments SET variants = $1 WHERE flag_id = 1 AND environment_id = 1`, [
    JSON.stringify([{ value: true, from: 10, to: 40 }]),
  ]);
  assert.equal((await (await list('dev')).json()).flags[0].rollout, null);
  await pool.query(`UPDATE flag_environments SET variants = $1 WHERE flag_id = 1 AND environment_id = 1`, [
    JSON.stringify([{ value: false, from: 0, to: 40 }]),
  ]);
  assert.equal((await (await list('dev')).json()).flags[0].rollout, null);
});

test('a missing or unknown env gets 400', async () => {
  for (const env of [undefined, '', 'staging', 'PROD']) {
    assert.equal((await list(env)).status, 400, String(env));
  }
});

test('with no project, or no such environment in the open project, the list gets 404', async () => {
  await pool.query(`DELETE FROM flag_environments WHERE environment_id = 2; DELETE FROM sdk_keys WHERE environment_id = 2;
                    DELETE FROM environments WHERE id = 2`);
  assert.equal((await list('prod')).status, 404);
  await pool.query('TRUNCATE projects RESTART IDENTITY CASCADE');
  assert.equal((await list('dev')).status, 404);
});

// --- switch (kill switch) ----------------------------------------------------------

test('turning a flag off bumps that environment version by 1, writes one audit row and changes the SDK config', async () => {
  const res = await patch('new-checkout', 'dev', { enabled: false });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { flag: { ...newCheckoutDev, enabled: false }, version: 8 });
  assert.equal(await version(1), 8);
  assert.equal(await version(2), 3, 'prod untouched');
  assert.equal((await flagRow(1, 1)).enabled, false);
  assert.deepEqual(await audit(), [
    { environment_id: 1, flag_id: 1, action: 'disable', before: { enabled: true }, after: { enabled: false }, config_version: 8 },
  ]);
  const config = await sdkConfig('key-a-dev');
  assert.equal(config.headers.get('etag'), '"8"');
  assert.equal((await config.json()).flags['new-checkout'].enabled, false);
});

test('turning a flag on in prod is the same change, recorded as enable', async () => {
  const res = await patch('new-checkout', 'prod', { enabled: true });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    flag: { key: 'new-checkout', type: 'boolean', enabled: true, default: false, ruleCount: 0, variants: [], rollout: 0 },
    version: 4,
  });
  assert.equal(await version(1), 7, 'dev untouched');
  assert.deepEqual(await audit(), [
    { environment_id: 2, flag_id: 1, action: 'enable', before: { enabled: false }, after: { enabled: true }, config_version: 4 },
  ]);
});

test('the switch works on a multivariate flag too', async () => {
  const res = await patch('reserve-button-color', 'dev', { enabled: false });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).flag.enabled, false);
  assert.equal(await version(1), 8);
});

// --- rollout -----------------------------------------------------------------------

test('rollout N on a boolean flag sets variants to [true, 0..N], keeps default and enabled, bumps once, audits', async () => {
  const res = await patch('new-checkout', 'dev', { rollout: 55 });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    flag: { ...newCheckoutDev, variants: [{ value: true, from: 0, to: 55 }], rollout: 55 },
    version: 8,
  });
  const row = await flagRow(1, 1);
  assert.deepEqual(row.variants, [{ value: true, from: 0, to: 55 }]);
  assert.equal(row.enabled, true);
  assert.equal(row.default, false);
  assert.deepEqual(row.rules, [{ attribute: 'country', operator: 'in', values: ['RO', 'MD'], serve: true }]);
  assert.deepEqual(await audit(), [
    {
      environment_id: 1,
      flag_id: 1,
      action: 'rollout',
      before: { variants: [{ value: true, from: 0, to: 30 }] },
      after: { variants: [{ value: true, from: 0, to: 55 }] },
      config_version: 8,
    },
  ]);
  const config = await (await sdkConfig('key-a-dev')).json();
  assert.equal(config.version, 8);
  assert.deepEqual(config.flags['new-checkout'].variants, [{ value: true, from: 0, to: 55 }]);
});

test('rollout 0 and 100 are accepted', async () => {
  assert.equal((await patch('new-checkout', 'dev', { rollout: 0 })).status, 200);
  assert.deepEqual((await flagRow(1, 1)).variants, [{ value: true, from: 0, to: 0 }]);
  assert.equal((await patch('new-checkout', 'dev', { rollout: 100 })).status, 200);
  assert.deepEqual((await flagRow(1, 1)).variants, [{ value: true, from: 0, to: 100 }]);
  assert.equal(await version(1), 9);
});

test('rollout on a multivariate flag gets 400 and changes nothing', async () => {
  assert.equal((await patch('reserve-button-color', 'dev', { rollout: 50 })).status, 400);
  assert.equal(await version(1), 7);
  assert.deepEqual(await audit(), []);
});

// --- bad requests ------------------------------------------------------------------

test('a body other than exactly one of {enabled: boolean} or {rollout: 0..100 integer} gets 400', async () => {
  for (const body of [
    {},
    { enabled: 'false' },
    { enabled: 0 },
    { enabled: null },
    { rollout: -1 },
    { rollout: 101 },
    { rollout: 12.5 },
    { rollout: '30' },
    { rollout: null },
    { enabled: false, rollout: 10 },
    { enabled: false, extra: 1 },
    [{ enabled: false }],
    'null',
    '{not json',
  ]) {
    assert.equal((await patch('new-checkout', 'dev', body)).status, 400, JSON.stringify(body));
  }
  assert.equal(await version(1), 7);
  assert.deepEqual(await audit(), []);
});

test('a PATCH that is not application/json gets 415 and changes nothing', async () => {
  for (const type of ['text/plain', 'application/x-www-form-urlencoded']) {
    assert.equal((await patch('new-checkout', 'dev', JSON.stringify({ enabled: false }), type)).status, 415, type);
  }
  assert.equal((await flagRow(1, 1)).enabled, true);
  assert.equal(await version(1), 7);
});

test('a bad env gets 400; a flag with no row in that environment, of another project, or unknown gets 404', async () => {
  assert.equal((await patch('new-checkout', 'staging', { enabled: false })).status, 400);
  assert.equal((await patch('reserve-button-color', 'prod', { enabled: false })).status, 404);
  assert.equal((await patch('other-project-flag', 'dev', { enabled: false })).status, 404);
  assert.equal((await patch('no-such-flag', 'dev', { enabled: false })).status, 404);
  assert.equal((await patch('bad\u0000key', 'dev', { enabled: false })).status, 404);
  assert.equal(await version(1), 7);
  assert.equal(await version(2), 3);
  assert.deepEqual(await audit(), []);
});

// --- no-op, rollback, concurrency (D-020) -------------------------------------------

test('a value that is already set gets 200 with the current version, no bump and no audit row', async () => {
  const on = await patch('new-checkout', 'dev', { enabled: true });
  assert.equal(on.status, 200);
  assert.deepEqual(await on.json(), { flag: newCheckoutDev, version: 7 });
  const same = await patch('new-checkout', 'dev', { rollout: 30 });
  assert.equal(same.status, 200);
  assert.equal((await same.json()).version, 7);
  assert.equal(await version(1), 7);
  assert.deepEqual(await audit(), []);
});

test('a database error inside the write gets 500 and rolls everything back', async (t) => {
  t.mock.method(console, 'error', () => {});
  // Every new audit row now fails, after the flag and version updates ran.
  await pool.query(`ALTER TABLE audit_log ADD CONSTRAINT test_fail_audit CHECK (action = 'none') NOT VALID`);
  try {
    assert.equal((await patch('new-checkout', 'dev', { enabled: false })).status, 500);
    assert.equal((await patch('new-checkout', 'dev', { rollout: 80 })).status, 500);
  } finally {
    await pool.query('ALTER TABLE audit_log DROP CONSTRAINT test_fail_audit');
  }
  const row = await flagRow(1, 1);
  assert.equal(row.enabled, true);
  assert.deepEqual(row.variants, [{ value: true, from: 0, to: 30 }]);
  assert.equal(await version(1), 7);
  assert.deepEqual(await audit(), []);
});

test('changes at the same time each get their own version: +1 per change, one audit row each', async () => {
  const results = await Promise.all([
    patch('new-checkout', 'dev', { enabled: false }),
    patch('new-checkout', 'dev', { rollout: 70 }),
    patch('reserve-button-color', 'dev', { enabled: false }),
  ]);
  assert.deepEqual(results.map((r) => r.status), [200, 200, 200]);
  const versions = (await Promise.all(results.map((r) => r.json()))).map((b) => b.version).sort();
  assert.deepEqual(versions, [8, 9, 10]);
  assert.equal(await version(1), 10);
  const rows = await audit();
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.config_version).sort(), [8, 9, 10]);
  const row = await flagRow(1, 1);
  assert.equal(row.enabled, false);
  assert.deepEqual(row.variants, [{ value: true, from: 0, to: 70 }]);
});
