import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as sleep } from 'node:timers/promises';
import { createPool } from '../src/db.js';
import { testPool } from './helpers.js';

// A pooled connection that PostgreSQL drops while it is idle (a db restart, a killed
// backend) must not take the server process down; the pool replaces it.
test('the pool survives an idle connection being terminated', async (t) => {
  t.mock.method(console, 'error', () => {}); // the pool logs the error; keep the output clean
  testPool().end(); // only for the *_test guard on TEST_DATABASE_URL
  const pool = createPool(process.env.TEST_DATABASE_URL);
  const admin = testPool();
  t.after(() => Promise.all([pool.end(), admin.end()]));

  const { rows } = await pool.query('SELECT pg_backend_pid() AS pid'); // the client goes back idle
  await admin.query('SELECT pg_terminate_backend($1)', [rows[0].pid]);
  // Wait until the pool has dropped the dead client (no listener of our own on 'error':
  // that would hide a missing handler in createPool).
  while (pool.totalCount > 0) await sleep(20);
  await sleep(50);

  assert.equal((await pool.query('SELECT 1 AS one')).rows[0].one, 1);
});
