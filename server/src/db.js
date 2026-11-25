// PostgreSQL access: one pool per process, and the schema applied at start.
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const schemaUrl = new URL('../db/schema.sql', import.meta.url);

export function createPool(connectionString) {
  return new pg.Pool({ connectionString });
}

// schema.sql only uses IF NOT EXISTS, so this is safe on every start.
export async function migrate(pool) {
  await pool.query(await readFile(schemaUrl, 'utf8'));
}
