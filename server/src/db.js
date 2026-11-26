// PostgreSQL access: one pool per process, and the schema applied at start.
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const schemaUrl = new URL('../db/schema.sql', import.meta.url);

// An idle connection that PostgreSQL drops (restart, killed backend) makes the pool
// emit 'error'; without a listener Node would throw and stop the server. The pool
// has already removed that client and opens a new one on the next query.
export function createPool(connectionString) {
  const pool = new pg.Pool({ connectionString });
  pool.on('error', (err) => console.error('PostgreSQL: idle connection dropped:', err.message));
  return pool;
}

// schema.sql only uses IF NOT EXISTS, so this is safe on every start.
export async function migrate(pool) {
  await pool.query(await readFile(schemaUrl, 'utf8'));
}

// Runs fn(client) inside one transaction on one client and returns its result; any
// error rolls back and is rethrown. A client whose ROLLBACK fails is destroyed.
async function withTransaction(pool, begin, fn) {
  const client = await pool.connect();
  let broken;
  try {
    await client.query(begin);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch((rollbackErr) => {
      broken = rollbackErr;
    });
    throw err;
  } finally {
    client.release(broken);
  }
}

// Reads that must agree with each other (Q-028, D-020): one snapshot for all of them.
export const readSnapshot = (pool, fn) => withTransaction(pool, 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY', fn);

// Writes that succeed or fail together (D-020).
export const transaction = (pool, fn) => withTransaction(pool, 'BEGIN', fn);
