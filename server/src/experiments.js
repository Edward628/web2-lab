// The results of the experiments in one environment (C-007, D-001, D-021): exposed and
// converted users per variant (D-005: both already unique per user), and every variant
// against the control, which is the flag's default. Runs inside the caller's snapshot.
import { isDeepStrictEqual } from 'node:util';
import { minSample, compare, verdict } from './stats.js';

// Rows: the configured variants in order, then the control if it is not one of them,
// then any other exposed value, by JSON text.
function variantRows(variants, control, counts) {
  const values = [];
  const add = (value) => {
    if (!values.some((v) => isDeepStrictEqual(v, value))) values.push(value);
  };
  for (const v of variants) add(v.value);
  add(control);
  const configured = values.length;
  for (const c of counts) add(c.variant);
  const extra = values.slice(configured).sort((a, b) => {
    const [x, y] = [JSON.stringify(a), JSON.stringify(b)];
    return x < y ? -1 : x > y ? 1 : 0;
  });
  return [...values.slice(0, configured), ...extra].map((value) => {
    const c = counts.find((row) => isDeepStrictEqual(row.variant, value));
    const exposed = c?.exposed ?? 0;
    const converted = c?.converted ?? 0;
    return { value, exposed, converted, rate: exposed === 0 ? null : converted / exposed };
  });
}

export async function experimentResults(db, environmentId) {
  const experiments = await db.query(
    `SELECT x.id, f.key, x.metric, x.baseline_rate, x.mde, fe."default", fe.variants
       FROM experiments x
       JOIN flags f ON f.id = x.flag_id
       JOIN flag_environments fe ON fe.flag_id = x.flag_id AND fe.environment_id = x.environment_id
      WHERE x.environment_id = $1
      ORDER BY f.key`,
    [environmentId],
  );
  const counts = await db.query(
    `SELECT e.experiment_id, e.variant, count(*)::int AS exposed, count(c.user_id)::int AS converted
       FROM exposures e
       LEFT JOIN conversions c ON c.experiment_id = e.experiment_id AND c.user_id = e.user_id
      WHERE e.experiment_id = ANY($1)
      GROUP BY e.experiment_id, e.variant`,
    [experiments.rows.map((x) => x.id)],
  );

  return experiments.rows.map((x) => {
    const n = minSample(x.baseline_rate, x.mde);
    const rows = variantRows(x.variants, x.default, counts.rows.filter((c) => c.experiment_id === x.id));
    const control = rows.find((r) => isDeepStrictEqual(r.value, x.default));
    const comparisons = rows
      .filter((r) => r !== control)
      .map((r) => {
        const stats = compare(control, r);
        const minSampleReached = control.exposed >= n && r.exposed >= n;
        return { variant: r.value, ...stats, minSampleReached, ...verdict(stats.pValue, minSampleReached) };
      });
    return {
      flagKey: x.key,
      metric: x.metric,
      baseline: x.baseline_rate,
      mde: x.mde,
      minSample: n,
      control: x.default,
      variants: rows,
      comparisons,
    };
  });
}
