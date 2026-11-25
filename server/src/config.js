// Builds the configuration of the environment an SDK key belongs to, in the C-001
// shape: { version, flags: { <flag_key>: { type, enabled, default, rules, variants } } },
// plus experiment: true on a flag that has an experiment in this environment.

// → the configuration, or null when the key is unknown.
export async function buildConfig(pool, sdkKey) {
  const env = await pool.query(
    `SELECT e.id, e.config_version
       FROM sdk_keys k JOIN environments e ON e.id = k.environment_id
      WHERE k.key = $1`,
    [sdkKey],
  );
  if (env.rowCount === 0) return null;
  const { id, config_version: version } = env.rows[0];

  const rows = await pool.query(
    `SELECT f.key, f.type, fe.enabled, fe."default", fe.rules, fe.variants, x.id IS NOT NULL AS experiment
       FROM flag_environments fe JOIN flags f ON f.id = fe.flag_id
       LEFT JOIN experiments x ON x.flag_id = fe.flag_id AND x.environment_id = fe.environment_id
      WHERE fe.environment_id = $1
      ORDER BY f.key`,
    [id],
  );
  const flags = {};
  for (const r of rows.rows) {
    flags[r.key] = { type: r.type, enabled: r.enabled, default: r.default, rules: r.rules, variants: r.variants };
    if (r.experiment) flags[r.key].experiment = true;
  }
  return { version, flags };
}
