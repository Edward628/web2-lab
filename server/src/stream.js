// GET /sdk/stream (C-006): "event: version / data: <config_version>" on connect and
// every 15 s while at least one stream of that environment is open. One timer per
// environment, cleared with its last stream, so no query runs (and Neon may suspend)
// when nobody is connected. A failed read skips that tick; the stream stays open.
// At most MAX_STREAMS open in total, across environments (Q-037); full() is checked by
// the route right before add(), with no await between them, so the cap is exact.

const INTERVAL_MS = 15000;
export const MAX_STREAMS = 200;

// → { id, version } of the key's environment, or null when the key is unknown. A key
// with a NUL cannot be stored, so it is unknown without a query (as buildConfig).
export async function streamTarget(pool, sdkKey) {
  if (sdkKey.includes('\u0000')) return null;
  const r = await pool.query(
    `SELECT e.id, e.config_version
       FROM sdk_keys k JOIN environments e ON e.id = k.environment_id
      WHERE k.key = $1`,
    [sdkKey],
  );
  if (r.rowCount === 0) return null;
  return { id: r.rows[0].id, version: r.rows[0].config_version };
}

export function createStreams(pool) {
  const environments = new Map(); // environment id → { clients: Set<res>, timer }
  let open = 0; // streams open, all environments

  const send = (res, version) => res.write(`event: version\ndata: ${version}\n\n`);

  async function tick(environmentId) {
    let r;
    try {
      r = await pool.query('SELECT config_version FROM environments WHERE id = $1', [environmentId]);
    } catch (err) {
      console.error(`GET /sdk/stream: database error on environment ${environmentId}; tick skipped`, err);
      return;
    }
    if (r.rowCount === 0) return;
    for (const res of environments.get(environmentId)?.clients ?? []) send(res, r.rows[0].config_version);
  }

  // Starts a stream on `res` (headers already set) with the version just read.
  function add(environmentId, version, res) {
    if (res.closed) return; // the client left while the key was being looked up
    let env = environments.get(environmentId);
    if (!env) {
      env = { clients: new Set(), timer: setInterval(() => tick(environmentId), INTERVAL_MS) };
      env.timer.unref?.();
      environments.set(environmentId, env);
    }
    env.clients.add(res);
    open += 1;
    send(res, version);
    res.on('close', () => {
      env.clients.delete(res);
      open -= 1;
      if (env.clients.size === 0) {
        clearInterval(env.timer);
        environments.delete(environmentId);
      }
    });
  }

  const full = () => open >= MAX_STREAMS;

  return { add, full };
}
