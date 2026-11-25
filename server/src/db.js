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
