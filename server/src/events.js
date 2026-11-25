// Event ingest (C-003, D-005): a batch of exposures, conversions and evaluation
// counts from the SDK, stored for the environment of the SDK key.

const isString = (v) => typeof v === 'string';
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

function isValidEvent(e) {
  if (!isObject(e) || !isString(e.id) || e.id.length < 1 || e.id.length > 64) return false;
  switch (e.type) {
    case 'exposure':
      return isString(e.userId) && isString(e.flagKey) && Object.hasOwn(e, 'variant');
    case 'conversion':
      return isString(e.userId) && isString(e.metric);
    case 'evaluations':
      return isObject(e.counts) && Object.values(e.counts).every((n) => Number.isInteger(n) && n >= 1);
    default:
      return false;
  }
}

// → the events array, or null when the body does not have the C-003 shape.
export function validateBatch(body) {
  if (!isObject(body) || !Array.isArray(body.events) || body.events.length === 0) return null;
  return body.events.every(isValidEvent) ? body.events : null;
}

// → the environment id of an SDK key, or null when the key is unknown.
export async function environmentOf(pool, sdkKey) {
  const r = await pool.query('SELECT environment_id FROM sdk_keys WHERE key = $1', [sdkKey]);
  return r.rowCount === 0 ? null : r.rows[0].environment_id;
}

// One transaction, events in array order, so a conversion sees an exposure from
// earlier in the same batch, and a failed batch stores nothing (the SDK resends it).
export async function ingestBatch(pool, environmentId, events) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const e of events) {
      const fresh = await client.query(
        'INSERT INTO ingested_events (environment_id, id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [environmentId, e.id],
      );
      if (fresh.rowCount === 0) continue; // id seen before: ignored

      if (e.type === 'exposure') {
        await client.query(
          `INSERT INTO exposures (experiment_id, user_id, variant)
           SELECT x.id, $3, $4 FROM experiments x JOIN flags f ON f.id = x.flag_id
            WHERE x.environment_id = $1 AND f.key = $2
           ON CONFLICT DO NOTHING`,
          [environmentId, e.flagKey, e.userId, JSON.stringify(e.variant)],
        );
      } else if (e.type === 'conversion') {
        // Only experiments the user was already exposed to (D-005).
        await client.query(
          `INSERT INTO conversions (experiment_id, user_id)
           SELECT x.id, p.user_id FROM experiments x
             JOIN exposures p ON p.experiment_id = x.id AND p.user_id = $3
            WHERE x.environment_id = $1 AND x.metric = $2
           ON CONFLICT DO NOTHING`,
          [environmentId, e.metric, e.userId],
        );
      } else {
        await client.query(
          `UPDATE flag_environments fe SET last_evaluated_at = now()
             FROM flags f
            WHERE f.id = fe.flag_id AND fe.environment_id = $1 AND f.key = ANY ($2)`,
          [environmentId, Object.keys(e.counts)],
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
