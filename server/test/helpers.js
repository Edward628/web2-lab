// Shared setup for the server tests: a pool on the test database, a clean schema,
// fixtures for two projects, and the app listening on a random port.
import pg from 'pg';
import { migrate } from '../src/db.js';
import { createApp } from '../src/app.js';

// The tests truncate every table, so they refuse any database not named *_test.
export function testPool() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL is not set (see .env.example)');
  if (!new URL(url).pathname.endsWith('_test')) {
    throw new Error('TEST_DATABASE_URL must point at a database whose name ends in _test');
  }
  return new pg.Pool({ connectionString: url });
}

export async function reset(pool) {
  await migrate(pool);
  await pool.query(
    `TRUNCATE projects, environments, sdk_keys, flags, flag_environments,
              experiments, exposures, conversions, ingested_events RESTART IDENTITY CASCADE`,
  );
}

// Project A: dev (version 7, key-a-dev) and prod (version 3, key-a-prod).
// Project B: dev (version 1, key-b-dev). Rows are inserted in this order, so ids are fixed.
export async function seed(pool) {
  await pool.query(`
    INSERT INTO projects (name) VALUES ('A'), ('B');
    INSERT INTO environments (project_id, name, config_version) VALUES (1, 'dev', 7), (1, 'prod', 3), (2, 'dev', 1);
    INSERT INTO sdk_keys (key, environment_id) VALUES ('key-a-dev', 1), ('key-a-prod', 2), ('key-b-dev', 3);
    INSERT INTO flags (project_id, key, type) VALUES
      (1, 'new-checkout', 'boolean'), (1, 'reserve-button-color', 'multivariate'), (2, 'other-project-flag', 'boolean');
  `);
  await addFlagEnvironment(pool, 1, 1, {
    enabled: true,
    default: false,
    rules: [{ attribute: 'country', operator: 'in', values: ['RO', 'MD'], serve: true }],
    variants: [{ value: true, from: 0, to: 30 }],
  });
  await addFlagEnvironment(pool, 2, 1, {
    enabled: true,
    default: 'blue',
    rules: [{ attribute: 'plan', operator: 'equals', value: 'beta', serve: 'green' }],
    variants: [
      { value: 'blue', from: 0, to: 50 },
      { value: 'green', from: 50, to: 100 },
    ],
  });
  await addFlagEnvironment(pool, 1, 2, { enabled: false, default: false, rules: [], variants: [] });
  await addFlagEnvironment(pool, 3, 3, { enabled: true, default: true, rules: [], variants: [] });
}

export function addFlagEnvironment(pool, flagId, environmentId, { enabled, default: def, rules, variants }) {
  return pool.query(
    `INSERT INTO flag_environments (flag_id, environment_id, enabled, "default", rules, variants)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [flagId, environmentId, enabled, JSON.stringify(def), JSON.stringify(rules), JSON.stringify(variants)],
  );
}

// An experiment on a flag in one environment, with its metric (C-003). Ids start at 1.
export function addExperiment(pool, flagId, environmentId, metric) {
  return pool.query('INSERT INTO experiments (flag_id, environment_id, metric) VALUES ($1, $2, $3)', [
    flagId,
    environmentId,
    metric,
  ]);
}

// Starts the app on a random port; returns its base URL and a close function.
export async function listen(pool) {
  const server = createApp({ pool }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  // Open streams (C-006) would keep close() waiting, so their connections are ended first.
  const close = () =>
    new Promise((r) => {
      server.close(r);
      server.closeAllConnections();
    });
  return { baseUrl, close };
}
