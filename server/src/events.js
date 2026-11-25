// Event ingest (C-003, D-005): a batch of exposures, conversions and evaluation
// counts from the SDK, stored for the environment of the SDK key.

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

// Text PostgreSQL can store as is: no NUL (rejected by text and jsonb) and no lone
// surrogate (pg would turn it into U+FFFD, so two different ids could become one).
const isStorable = (s) => !s.includes('\u0000') && s.isWellFormed();
const isText = (v, max) => typeof v === 'string' && v.length <= max && isStorable(v);
const TEXT_MAX = 256; // userId, flagKey, metric: fits the btree index of exposures / conversions

// Every string in a JSON value, keys included, is storable in jsonb.
function isStorableJson(v) {
  if (typeof v === 'string') return isStorable(v);
  if (Array.isArray(v)) return v.every(isStorableJson);
  if (isObject(v)) return Object.entries(v).every(([k, x]) => isStorable(k) && isStorableJson(x));
  return true;
}

function isValidEvent(e) {
  if (!isObject(e) || !isText(e.id, 64) || e.id.length < 1) return false;
  switch (e.type) {
    case 'exposure':
      return (
        isText(e.userId, TEXT_MAX) && isText(e.flagKey, TEXT_MAX) && Object.hasOwn(e, 'variant') && isStorableJson(e.variant)
      );
    case 'conversion':
      return isText(e.userId, TEXT_MAX) && isText(e.metric, TEXT_MAX);
    case 'evaluations':
      return (
        isObject(e.counts) &&
        Object.entries(e.counts).every(([k, n]) => isText(k, TEXT_MAX) && Number.isInteger(n) && n >= 1)
      );
    default:
      return false;
  }
}

// → the events array, or null when the body does not have the C-003 shape.
export function validateBatch(body) {
  if (!isObject(body) || !Array.isArray(body.events) || body.events.length === 0) return null;
  return body.events.every(isValidEvent) ? body.events : null;
}

// → the environment id of an SDK key, or null when the key is unknown (a key
// PostgreSQL could not store cannot exist, so it is unknown without a query).
export async function environmentOf(pool, sdkKey) {
  if (!isStorable(sdkKey)) return null;
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
