// The audit log of one environment (C-007, D-020): newest first, one page of 50, with a
// `before` id cursor so rows added while the admin reads never shift the older pages.
// Ordered by id: every write in an environment bumps its config_version under a row lock,
// so ids there follow the version order. Runs inside the caller's snapshot.
export const AUDIT_PAGE = 50;

// → { entries, nextBefore }; flag = a flag key or null, before = an id or null.
export async function auditEntries(db, environmentId, { flag, before }) {
  const r = await db.query(
    `SELECT a.id, a.at, f.key, a.action, a.before, a.after, a.config_version
       FROM audit_log a JOIN flags f ON f.id = a.flag_id
      WHERE a.environment_id = $1
        AND ($2::text IS NULL OR f.key = $2)
        AND ($3::int IS NULL OR a.id < $3)
      ORDER BY a.id DESC
      LIMIT $4`,
    [environmentId, flag, before, AUDIT_PAGE + 1],
  );
  const rows = r.rows.slice(0, AUDIT_PAGE);
  return {
    entries: rows.map((row) => ({
      id: row.id,
      at: row.at.toISOString(),
      flagKey: row.key,
      action: row.action,
      before: row.before,
      after: row.after,
      configVersion: row.config_version,
    })),
    nextBefore: r.rows.length > AUDIT_PAGE ? rows[rows.length - 1].id : null,
  };
}
