import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword } from '../src/admin.js';
import { testPool, reset, seed, listen } from './helpers.js';

// GET /admin/audit (C-007): the audit_log rows of the open project's environment, newest
// first (id descending), 50 a page, with a `before` cursor and a server-side `flag` filter.
// Rows come from real PATCH changes (D-020) or, for paging, straight inserts. Fixtures:
// helpers.js (project A: dev = environment 1 v7, prod = 2 v3; flag 1 new-checkout boolean,
// flag 2 reserve-button-color multivariate; project B: environment 3, flag 3).
const PASSWORD = 'test-only password';
const PAGE = 50;
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

const get = (query, headers = { Cookie: cookie }) => fetch(`${app.baseUrl}/admin/audit${query}`, { headers });
const body = async (query) => {
  const res = await get(query);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^application\/json/);
  return res.json();
};
const patch = async (key, env, change) => {
  const res = await fetch(`${app.baseUrl}/admin/flags/${encodeURIComponent(key)}?env=${env}`, {
    method: 'PATCH',
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify(change),
  });
  assert.equal(res.status, 200);
};
// `count` audit rows in one environment for one flag, version 100 + n, inserted in order.
const addRows = (environmentId, flagId, count) =>
  pool.query(
    `INSERT INTO audit_log (environment_id, flag_id, action, before, after, config_version)
       SELECT $1, $2, 'enable', '{"enabled": false}', '{"enabled": true}', 100 + n FROM generate_series(1, $3::int) AS n`,
    [environmentId, flagId, count],
  );
const ids = (entries) => entries.map((e) => e.id);
const range = (from, to) => Array.from({ length: from - to + 1 }, (_, i) => from - i); // from ↓ to

// --- access and errors --------------------------------------------------------------------

test('without a session the audit log gets 401, no body', async () => {
  for (const headers of [{}, { Cookie: 'ff_admin=unknown' }]) {
    const res = await get('?env=dev', headers);
    assert.equal(res.status, 401);
    assert.equal(await res.text(), '');
  }
});

test('a missing or unknown env, a bad before, an empty flag or a repeated parameter gets 400, no body', async () => {
  for (const query of [
    '',
    '?env=',
    '?env=staging',
    '?env=PROD',
    '?env=dev&env=prod',
    '?env=dev&before=',
    '?env=dev&before=0',
    '?env=dev&before=-1',
    '?env=dev&before=1.5',
    '?env=dev&before=abc',
    '?env=dev&before=2147483648',
    '?env=dev&before=5&before=6',
    '?env=dev&flag=',
    '?env=dev&flag=a&flag=b',
  ]) {
    const res = await get(query);
    assert.equal(res.status, 400, query);
    assert.equal(await res.text(), '', query);
  }
  assert.equal((await get('?env=dev&before=2147483647')).status, 200, 'the largest serial id is accepted');
});

test('with no project, or no such environment in the open project, the audit log gets 404', async () => {
  await pool.query(`DELETE FROM flag_environments WHERE environment_id = 2; DELETE FROM sdk_keys WHERE environment_id = 2;
                    DELETE FROM environments WHERE id = 2`);
  assert.equal((await get('?env=prod')).status, 404);
  await pool.query('TRUNCATE projects RESTART IDENTITY CASCADE');
  const res = await get('?env=dev');
  assert.equal(res.status, 404);
  assert.equal(await res.text(), '');
});

test('a database error gets 500, no body', async (t) => {
  t.mock.method(console, 'error', () => {});
  t.mock.method(pool, 'connect', async () => {
    throw new Error('test: database down');
  });
  const res = await get('?env=dev');
  t.mock.restoreAll();
  assert.equal(res.status, 500);
  assert.equal(await res.text(), '');
});

// --- entries ------------------------------------------------------------------------------

test('an empty log is 200 with the project, the environment, no entries and no next page', async () => {
  assert.deepEqual(await body('?env=dev'), {
    project: { id: 1, name: 'A' },
    environment: 'dev',
    entries: [],
    nextBefore: null,
  });
});

test('real changes come back newest first, with the stored before / after and the new config version', async () => {
  const start = Date.now();
  await patch('new-checkout', 'dev', { enabled: false }); // v8
  await patch('new-checkout', 'dev', { rollout: 50 }); // v9
  await patch('new-checkout', 'dev', { enabled: true }); // v10
  const { entries, nextBefore } = await body('?env=dev');
  assert.equal(nextBefore, null);

  for (const e of entries) {
    assert.match(e.at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'ISO 8601 in UTC');
    assert.ok(Date.parse(e.at) >= start - 1000 && Date.parse(e.at) <= Date.now() + 1000, e.at);
  }
  assert.deepEqual(
    entries.map(({ at, ...rest }) => rest),
    [
      { id: 3, flagKey: 'new-checkout', action: 'enable', before: { enabled: false }, after: { enabled: true }, configVersion: 10 },
      {
        id: 2,
        flagKey: 'new-checkout',
        action: 'rollout',
        before: { variants: [{ value: true, from: 0, to: 30 }] },
        after: { variants: [{ value: true, from: 0, to: 50 }] },
        configVersion: 9,
      },
      { id: 1, flagKey: 'new-checkout', action: 'disable', before: { enabled: true }, after: { enabled: false }, configVersion: 8 },
    ],
  );
});

test("only the requested environment's rows, and only the open project's", async () => {
  await patch('new-checkout', 'dev', { enabled: false }); // id 1, dev
  await patch('new-checkout', 'prod', { enabled: true }); // id 2, prod
  await addRows(3, 3, 1); // id 3, project B
  assert.deepEqual(ids((await body('?env=dev')).entries), [1]);
  const prod = await body('?env=prod');
  assert.equal(prod.environment, 'prod');
  assert.deepEqual(ids(prod.entries), [2]);
});

// --- paging ---------------------------------------------------------------------------------

test('51 rows: the first page has the 50 newest and nextBefore = the id of the 50th; the next page has the rest', async () => {
  await addRows(1, 1, 51);
  const first = await body('?env=dev');
  assert.deepEqual(ids(first.entries), range(51, 2));
  assert.equal(first.nextBefore, 2);
  assert.equal(first.entries[0].configVersion, 151);

  const second = await body(`?env=dev&before=${first.nextBefore}`);
  assert.deepEqual(ids(second.entries), [1]);
  assert.equal(second.nextBefore, null);
});

test('exactly 50 rows fit one page, with no next page; before past the oldest row returns no entries', async () => {
  await addRows(1, 1, PAGE);
  const page = await body('?env=dev');
  assert.equal(page.entries.length, PAGE);
  assert.equal(page.nextBefore, null);
  assert.deepEqual(await body('?env=dev&before=1'), { project: { id: 1, name: 'A' }, environment: 'dev', entries: [], nextBefore: null });
});

test('before is exclusive and pages through rows newer than it never shift', async () => {
  await addRows(1, 1, 120);
  const first = await body('?env=dev');
  await addRows(1, 1, 5); // newer rows arrive while the admin reads
  const second = await body(`?env=dev&before=${first.nextBefore}`);
  assert.deepEqual(ids(second.entries), range(70, 21));
  assert.equal(second.nextBefore, 21);
  const third = await body(`?env=dev&before=${second.nextBefore}`);
  assert.deepEqual(ids(third.entries), range(20, 1));
  assert.equal(third.nextBefore, null);
});

// --- flag filter --------------------------------------------------------------------------

test('flag keeps only that flag, and pages within it', async () => {
  await addRows(1, 1, 30); // ids 1–30, new-checkout
  await addRows(1, 2, 30); // ids 31–60, reserve-button-color
  await addRows(1, 1, 30); // ids 61–90, new-checkout
  const first = await body('?env=dev&flag=new-checkout');
  assert.ok(first.entries.every((e) => e.flagKey === 'new-checkout'));
  assert.deepEqual(ids(first.entries), [...range(90, 61), ...range(30, 11)]);
  assert.equal(first.nextBefore, 11);
  const second = await body(`?env=dev&flag=new-checkout&before=${first.nextBefore}`);
  assert.deepEqual(ids(second.entries), range(10, 1));
  assert.equal(second.nextBefore, null);

  assert.deepEqual(ids((await body('?env=dev&flag=reserve-button-color')).entries), range(60, 31));
});

test('an unknown flag key, or one with NUL, is 200 with no entries', async () => {
  await addRows(1, 1, 3);
  for (const flag of ['nope', 'other-project-flag', encodeURIComponent('new-checkout\u0000')]) {
    assert.deepEqual(await body(`?env=dev&flag=${flag}`), {
      project: { id: 1, name: 'A' },
      environment: 'dev',
      entries: [],
      nextBefore: null,
    });
  }
});
