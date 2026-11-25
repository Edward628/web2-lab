// The ParkingLot seed: the project, its dev / prod environments, one SDK key each
// (128 random bits, Q-029) and the reserve-button-color experiment (blue / green
// 50/50, metric reserve_click). Idempotent: when ParkingLot exists, nothing changes
// and the existing keys are returned.
import { randomBytes } from 'node:crypto';

const PROJECT = 'ParkingLot';
const FLAG_KEY = 'reserve-button-color';
const METRIC = 'reserve_click';
const SETTINGS = {
  enabled: true,
  default: 'blue',
  rules: [],
  variants: [
    { value: 'blue', from: 0, to: 50 },
    { value: 'green', from: 50, to: 100 },
  ],
};

// → { dev, prod }: the SDK key of each environment.
export async function seedParkingLot(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT e.name, k.key
         FROM projects p
         JOIN environments e ON e.project_id = p.id
         JOIN sdk_keys k ON k.environment_id = e.id
        WHERE p.name = $1
        ORDER BY k.created_at, k.key`,
      [PROJECT],
    );
    if (existing.rowCount > 0) {
      await client.query('COMMIT');
      const keys = {};
      for (const r of existing.rows) keys[r.name] ??= r.key;
      return { dev: keys.dev, prod: keys.prod };
    }

    const project = await client.query('INSERT INTO projects (name) VALUES ($1) RETURNING id', [PROJECT]);
    const projectId = project.rows[0].id;
    const flag = await client.query(
      `INSERT INTO flags (project_id, key, type) VALUES ($1, $2, 'multivariate') RETURNING id`,
      [projectId, FLAG_KEY],
    );
    const flagId = flag.rows[0].id;

    const keys = {};
    for (const name of ['dev', 'prod']) {
      const env = await client.query(
        'INSERT INTO environments (project_id, name) VALUES ($1, $2) RETURNING id',
        [projectId, name],
      );
      const envId = env.rows[0].id;
      keys[name] = randomBytes(16).toString('hex');
      await client.query('INSERT INTO sdk_keys (key, environment_id) VALUES ($1, $2)', [keys[name], envId]);
      await client.query(
        `INSERT INTO flag_environments (flag_id, environment_id, enabled, "default", rules, variants)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          flagId,
          envId,
          SETTINGS.enabled,
          JSON.stringify(SETTINGS.default),
          JSON.stringify(SETTINGS.rules),
          JSON.stringify(SETTINGS.variants),
        ],
      );
      await client.query('INSERT INTO experiments (flag_id, environment_id, metric) VALUES ($1, $2, $3)', [
        flagId,
        envId,
        METRIC,
      ]);
    }
    await client.query('COMMIT');
    return { dev: keys.dev, prod: keys.prod };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
