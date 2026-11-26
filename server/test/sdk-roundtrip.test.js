import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { init } from '../../sdk/src/index.js';
import { testPool, reset, seed, listen, addExperiment } from './helpers.js';

// Both sides of C-002 and C-003: the real SDK against the real server and PostgreSQL.
const pool = testPool();
let app;
before(async () => {
  await reset(pool);
  await seed(pool);
  app = await listen(pool);
});
after(async () => {
  await app?.close();
  await pool.end();
});

test('the SDK gets the configuration, then 304 on the next refresh', async () => {
  const ff = init({ sdkKey: 'key-a-dev', baseUrl: app.baseUrl });
  ff.identify('user-1', { country: 'RO' });
  assert.equal(ff.isEnabled('new-checkout'), false); // no configuration yet
  assert.equal(await ff.refresh(), 'updated');
  assert.equal(ff.isEnabled('new-checkout'), true); // rule country in [RO, MD]
  assert.equal(ff.getVariant('reserve-button-color'), 'blue'); // reserve-button-color + user-1 = bucket 40
  assert.equal(await ff.refresh(), 'not-modified');
});

test('an unknown key is an error for the SDK', async () => {
  const ff = init({ sdkKey: 'no-such-key', baseUrl: app.baseUrl });
  assert.equal(await ff.refresh(), 'error');
});

test('exposure, conversion and evaluations travel from the SDK to the database', async () => {
  await addExperiment(pool, 2, 1, 'reserve_click'); // reserve-button-color in A dev
  const ff = init({ sdkKey: 'key-a-dev', baseUrl: app.baseUrl });
  assert.equal(await ff.refresh(), 'updated');
  ff.identify('user-1');
  assert.equal(ff.getVariant('reserve-button-color'), 'blue'); // bucket 40, from a variant range
  ff.track('reserve_click');
  assert.equal(await ff.flush(), 'sent');
  const exposures = await pool.query('SELECT experiment_id, user_id, variant FROM exposures');
  assert.deepEqual(exposures.rows, [{ experiment_id: 1, user_id: 'user-1', variant: 'blue' }]);
  const conversions = await pool.query('SELECT experiment_id, user_id FROM conversions');
  assert.deepEqual(conversions.rows, [{ experiment_id: 1, user_id: 'user-1' }]);
  const evaluated = await pool.query('SELECT last_evaluated_at FROM flag_environments WHERE flag_id = 2 AND environment_id = 1');
  assert.ok(evaluated.rows[0].last_evaluated_at instanceof Date);
});

test('events sent with an unknown key are dropped', async () => {
  const ff = init({ sdkKey: 'no-such-key', baseUrl: app.baseUrl });
  ff.identify('user-1');
  ff.track('reserve_click');
  assert.equal(await ff.flush(), 'dropped');
});

// Both sides of C-006, with Node's EventSource (--experimental-eventsource in npm test).
test('connect() alone loads the configuration through the stream', async () => {
  assert.equal(typeof EventSource, 'function', 'run with --experimental-eventsource');
  const ff = init({ sdkKey: 'key-a-dev', baseUrl: app.baseUrl, storage: null });
  ff.identify('user-1', { country: 'RO' });
  ff.connect();
  try {
    for (let i = 0; i < 100 && !ff.isEnabled('new-checkout'); i++) await new Promise((r) => setTimeout(r, 20));
    assert.equal(ff.isEnabled('new-checkout'), true); // version 7 arrived, refresh() fetched it
    assert.equal(ff.status(), 'ok');
  } finally {
    ff.close();
  }
});
