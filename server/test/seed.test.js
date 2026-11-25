import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { isValidConfig } from '../../sdk/src/validate.js';
import { seedParkingLot } from '../src/seed.js';
import { testPool, reset, listen } from './helpers.js';

// The ParkingLot seed: the project, dev / prod, one SDK key each (128 random bits,
// Q-029), and the reserve-button-color experiment (blue / green 50/50, reserve_click).
const pool = testPool();
let app;
before(async () => {
  await reset(pool);
  app = await listen(pool);
});
beforeEach(() => reset(pool));
after(async () => {
  await app?.close();
  await pool.end();
});

const reserveButtonColor = {
  type: 'multivariate',
  enabled: true,
  default: 'blue',
  rules: [],
  variants: [
    { value: 'blue', from: 0, to: 50 },
    { value: 'green', from: 50, to: 100 },
  ],
  experiment: true,
};

test('creates ParkingLot with dev and prod at version 1, one 32-hex key each, and the experiment', async () => {
  const keys = await seedParkingLot(pool);
  assert.match(keys.dev, /^[0-9a-f]{32}$/);
  assert.match(keys.prod, /^[0-9a-f]{32}$/);
  assert.notEqual(keys.dev, keys.prod);

  const projects = (await pool.query('SELECT name FROM projects')).rows;
  assert.deepEqual(projects, [{ name: 'ParkingLot' }]);
  const envs = (await pool.query('SELECT name, config_version FROM environments ORDER BY name')).rows;
  assert.deepEqual(envs, [
    { name: 'dev', config_version: 1 },
    { name: 'prod', config_version: 1 },
  ]);
  const experiments = (
    await pool.query(
      `SELECT f.key, e.name AS env, x.metric
         FROM experiments x JOIN flags f ON f.id = x.flag_id JOIN environments e ON e.id = x.environment_id
        ORDER BY e.name`,
    )
  ).rows;
  assert.deepEqual(experiments, [
    { key: 'reserve-button-color', env: 'dev', metric: 'reserve_click' },
    { key: 'reserve-button-color', env: 'prod', metric: 'reserve_click' },
  ]);

  for (const [name, key] of Object.entries(keys)) {
    const res = await fetch(`${app.baseUrl}/sdk/config?key=${key}`);
    assert.equal(res.status, 200, name);
    const body = await res.json();
    assert.deepEqual(body, { version: 1, flags: { 'reserve-button-color': reserveButtonColor } }, name);
    assert.equal(isValidConfig(body), true);
  }
});

test('a second run changes nothing and returns the same keys', async () => {
  const first = await seedParkingLot(pool);
  const tables = ['projects', 'environments', 'sdk_keys', 'flags', 'flag_environments', 'experiments'];
  const snapshot = async () => {
    const out = {};
    for (const t of tables) out[t] = (await pool.query(`SELECT * FROM ${t} ORDER BY 1, 2`)).rows;
    return out;
  };
  const before = await snapshot();
  const second = await seedParkingLot(pool);
  assert.deepEqual(second, first);
  assert.deepEqual(await snapshot(), before);
});

test('two seeds at the same time create one project and return the same keys (review S5)', async () => {
  const [a, b] = await Promise.all([seedParkingLot(pool), seedParkingLot(pool)]);
  assert.deepEqual(a, b);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM projects')).rows[0].n, 1);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM sdk_keys')).rows[0].n, 2);
});

test('project names are unique (review S5)', async () => {
  await pool.query(`INSERT INTO projects (name) VALUES ('Same')`);
  await assert.rejects(pool.query(`INSERT INTO projects (name) VALUES ('Same')`), { code: '23505' });
});
