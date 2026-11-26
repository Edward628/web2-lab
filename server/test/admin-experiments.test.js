import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword } from '../src/admin.js';
import { testPool, reset, seed, listen, addExperiment, addExposures } from './helpers.js';

// GET /admin/experiments (C-007): per experiment of the open project in one environment,
// exposed and converted users and the rate per variant, and each variant against the
// control (the flag's default) with the difference, 95% CI, p-value, minimum sample and
// verdict (D-001, D-005, D-021). Fixtures: helpers.js (project A: dev = environment 1,
// prod = 2; flag 1 new-checkout, flag 2 reserve-button-color blue/green; project B: 3).
// The statistics themselves have reference values in stats.test.js.
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

const list = (env, headers = { Cookie: cookie }) =>
  fetch(`${app.baseUrl}/admin/experiments${env === undefined ? '' : `?env=${env}`}`, { headers });
const body = async (env) => {
  const res = await list(env);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^application\/json/);
  return res.json();
};

// The floating-point fields of a comparison, checked within a tolerance and then removed,
// so the rest can be compared exactly.
function takeStats(comparison, expected) {
  const { difference, ci, pValue, ...rest } = comparison;
  const close = (a, b, what) => assert.ok(Math.abs(a - b) <= 1e-9, `${what}: ${a} ≠ ${b}`);
  close(difference, expected.difference, 'difference');
  close(ci.low, expected.low, 'CI low');
  close(ci.high, expected.high, 'CI high');
  assert.ok(Math.abs(pValue - expected.pValue) <= 1e-6 * expected.pValue, `p-value: ${pValue} ≠ ${expected.pValue}`);
  return rest;
}

// --- 5. access and errors --------------------------------------------------------------

test('without a session the results get 401, no body', async () => {
  for (const headers of [{}, { Cookie: 'ff_admin=unknown' }]) {
    const res = await list('dev', headers);
    assert.equal(res.status, 401);
    assert.equal(await res.text(), '');
  }
});

test('a missing or unknown env gets 400', async () => {
  for (const env of [undefined, '', 'staging', 'PROD']) {
    const res = await list(env);
    assert.equal(res.status, 400, String(env));
    assert.equal(await res.text(), '');
  }
});

test('with no project, or no such environment in the open project, the results get 404', async () => {
  await pool.query(`DELETE FROM flag_environments WHERE environment_id = 2; DELETE FROM sdk_keys WHERE environment_id = 2;
                    DELETE FROM environments WHERE id = 2`);
  assert.equal((await list('prod')).status, 404);
  await pool.query('TRUNCATE projects RESTART IDENTITY CASCADE');
  assert.equal((await list('dev')).status, 404);
});

test('a database error gets 500, no body', async (t) => {
  t.mock.method(console, 'error', () => {});
  t.mock.method(pool, 'connect', async () => {
    throw new Error('test: database down');
  });
  const res = await list('dev');
  t.mock.restoreAll();
  assert.equal(res.status, 500);
  assert.equal(await res.text(), '');
});

// --- 6. counts per variant and comparisons with the control -----------------------------

test('counts exposed and converted users per variant; control = the default; one comparison per other variant', async () => {
  await addExperiment(pool, 2, 1, 'reserve_click');
  await addExposures(pool, 1, 'blue', 15, 3);
  await addExposures(pool, 1, 'green', 14, 5);
  const { experiments, ...head } = await body('dev');
  assert.deepEqual(head, { project: { id: 1, name: 'A' }, environment: 'dev' });
  assert.equal(experiments.length, 1);
  const [{ comparisons, ...experiment }] = experiments;
  assert.deepEqual(experiment, {
    flagKey: 'reserve-button-color',
    metric: 'reserve_click',
    baseline: 0.2,
    mde: 0.1,
    minSample: 294,
    control: 'blue',
    variants: [
      { value: 'blue', exposed: 15, converted: 3, rate: 3 / 15 },
      { value: 'green', exposed: 14, converted: 5, rate: 5 / 14 },
    ],
  });
  assert.equal(comparisons.length, 1);
  const stats = { difference: 0.15714285714285714, low: -0.1653059690230549, high: 0.47959168330876917, pValue: 0.34408468688062616 };
  assert.deepEqual(takeStats(comparisons[0], stats), { variant: 'green', minSampleReached: false, significant: false, peeking: false });
});

test('p < 0.05 with the minimum sample reached in both groups is significant', async () => {
  await addExperiment(pool, 2, 1, 'reserve_click');
  await addExposures(pool, 1, 'blue', 1000, 200);
  await addExposures(pool, 1, 'green', 1000, 240);
  const [{ comparisons }] = (await body('dev')).experiments;
  const stats = { difference: 0.04, low: 0.003732721356494509, high: 0.07626727864350545, pValue: 0.030837167828904333 };
  assert.deepEqual(takeStats(comparisons[0], stats), { variant: 'green', minSampleReached: true, significant: true, peeking: false });
});

test('p < 0.05 before the minimum sample is a peeking warning, not significant', async () => {
  await addExperiment(pool, 2, 1, 'reserve_click');
  await addExposures(pool, 1, 'blue', 100, 10);
  await addExposures(pool, 1, 'green', 100, 22);
  const [{ comparisons }] = (await body('dev')).experiments;
  const stats = { difference: 0.12, low: 0.019754021153286005, high: 0.22024597884671399, pValue: 0.0206375582439722 };
  assert.deepEqual(takeStats(comparisons[0], stats), { variant: 'green', minSampleReached: false, significant: false, peeking: true });
});

test('the minimum sample counts only when both groups reach it', async () => {
  await addExperiment(pool, 2, 1, 'reserve_click');
  await addExposures(pool, 1, 'blue', 294, 60);
  await addExposures(pool, 1, 'green', 293, 90);
  const [{ comparisons }] = (await body('dev')).experiments;
  assert.equal(comparisons[0].minSampleReached, false);
  assert.equal(comparisons[0].significant, false);
  assert.equal(comparisons[0].peeking, true);
  await pool.query(`INSERT INTO exposures (experiment_id, user_id, variant) VALUES (1, 'one-more', '"green"')`);
  const [{ comparisons: after }] = (await body('dev')).experiments;
  assert.equal(after[0].minSampleReached, true);
  assert.equal(after[0].significant, true);
  assert.equal(after[0].peeking, false);
});

test('a configured variant with no exposures shows 0 and rate null; its comparison has no statistics', async () => {
  await addExperiment(pool, 2, 1, 'reserve_click');
  await addExposures(pool, 1, 'blue', 4, 1);
  const [experiment] = (await body('dev')).experiments;
  assert.deepEqual(experiment.variants, [
    { value: 'blue', exposed: 4, converted: 1, rate: 0.25 },
    { value: 'green', exposed: 0, converted: 0, rate: null },
  ]);
  assert.deepEqual(experiment.comparisons, [
    { variant: 'green', difference: null, ci: null, pValue: null, minSampleReached: false, significant: false, peeking: false },
  ]);
});

test('a control outside the configured variants is added after them; other exposed values come last, by JSON text', async () => {
  // new-checkout in dev: default false, variants [{true, 0–30}] → users outside 0–30 see false.
  await addExperiment(pool, 1, 1, 'checkout_done');
  await addExposures(pool, 1, 'zeta', 2, 0);
  await addExposures(pool, 1, 'alpha', 1, 1);
  const [experiment] = (await body('dev')).experiments;
  assert.equal(experiment.control, false);
  assert.deepEqual(experiment.variants, [
    { value: true, exposed: 0, converted: 0, rate: null },
    { value: false, exposed: 0, converted: 0, rate: null },
    { value: 'alpha', exposed: 1, converted: 1, rate: 1 },
    { value: 'zeta', exposed: 2, converted: 0, rate: 0 },
  ]);
  assert.deepEqual(experiment.comparisons.map((c) => c.variant), [true, 'alpha', 'zeta']);
});

test('experiments are ordered by flag key', async () => {
  await addExperiment(pool, 2, 1, 'reserve_click');
  await addExperiment(pool, 1, 1, 'checkout_done');
  const { experiments } = await body('dev');
  assert.deepEqual(experiments.map((e) => [e.flagKey, e.metric]), [
    ['new-checkout', 'checkout_done'],
    ['reserve-button-color', 'reserve_click'],
  ]);
});

// --- 7. isolation -----------------------------------------------------------------------

test('an environment with no experiments returns an empty list', async () => {
  assert.deepEqual(await body('prod'), { project: { id: 1, name: 'A' }, environment: 'prod', experiments: [] });
});

test('another environment and another project are not counted', async () => {
  await addExperiment(pool, 2, 1, 'reserve_click'); // 1: A dev
  await addExperiment(pool, 1, 2, 'checkout_done'); // 2: A prod
  await addExperiment(pool, 3, 3, 'other_metric'); // 3: B dev
  await addExposures(pool, 1, 'blue', 3, 1);
  await addExposures(pool, 2, false, 7, 2);
  await addExposures(pool, 3, true, 9, 9);
  const dev = await body('dev');
  assert.deepEqual(dev.experiments.map((e) => e.flagKey), ['reserve-button-color']);
  assert.deepEqual(dev.experiments[0].variants.map((v) => v.exposed), [3, 0]);
  const prod = await body('prod');
  assert.deepEqual(prod.experiments.map((e) => e.flagKey), ['new-checkout']);
  // prod new-checkout: default false, no variants → only the control row.
  assert.deepEqual(prod.experiments[0].variants, [{ value: false, exposed: 7, converted: 2, rate: 2 / 7 }]);
  assert.deepEqual(prod.experiments[0].comparisons, []);
});

// --- 8. baseline and MDE per experiment -------------------------------------------------

test('baseline and MDE default to 0.20 and 0.10 (minimum 294); values set per experiment are used', async () => {
  await addExperiment(pool, 2, 1, 'reserve_click');
  await addExperiment(pool, 1, 1, 'checkout_done');
  await pool.query('UPDATE experiments SET baseline_rate = 0.1, mde = 0.05 WHERE id = 2');
  const { experiments } = await body('dev');
  assert.deepEqual(experiments.map((e) => [e.flagKey, e.baseline, e.mde, e.minSample]), [
    ['new-checkout', 0.1, 0.05, 686],
    ['reserve-button-color', 0.2, 0.1, 294],
  ]);
});

test('the schema refuses a baseline or MDE outside (0, 1), or a baseline + MDE of 1 or more', async () => {
  await addExperiment(pool, 2, 1, 'reserve_click');
  for (const [baseline, mde] of [[0, 0.1], [0.2, 0], [-0.1, 0.1], [0.2, -0.1], [0.9, 0.1], [0.95, 0.1]]) {
    await assert.rejects(
      pool.query('UPDATE experiments SET baseline_rate = $1, mde = $2 WHERE id = 1', [baseline, mde]),
      /check constraint/,
      `${baseline}, ${mde}`,
    );
  }
});
