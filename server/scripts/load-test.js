// Load test for event ingest (C-003, docs/LOAD-TEST.md): sends one 20-event batch every
// 20 ms (1,000 events/s) for 60 s to POST /sdk/events on the LOCAL stack, open-loop (a
// batch leaves on schedule whether or not earlier ones were answered), probes GET
// /sdk/config once a second, then compares the row counts with what was accepted.
// Refuses any host but 127.0.0.1 / localhost, so it can never reach Neon or Render (D-016).
//   cd server && set -a && . ../.env && set +a &&
//   DATABASE_URL=postgres://postgres:$POSTGRES_PASSWORD@127.0.0.1:5432/web2 npm run -s load-test [-- --duration 5]
// Options: --duration <s> (default 60), --rate <events/s> (default 1000). Exit 0 = PASS.
import { randomBytes } from 'node:crypto';
import { parseArgs } from 'node:util';
import { setTimeout as sleep } from 'node:timers/promises';
import { createPool } from '../src/db.js';
import { assertLocal, makeBatch, FLAG_KEY, summarize, latencyStats, expectedDeltas, verdict } from './load-test-lib.js';

const EVENTS_PER_BATCH = 20;
const TIMEOUT_MS = 10_000; // as the SDK (D-011)
const PROBE_MS = 1000;

const { values } = parseArgs({ options: { duration: { type: 'string', default: '60' }, rate: { type: 'string', default: '1000' } } });
const durationS = Number(values.duration);
const rate = Number(values.rate);
if (!(durationS > 0) || !(rate > 0)) {
  console.error('--duration and --rate must be positive numbers');
  process.exit(2);
}
const intervalMs = (EVENTS_PER_BATCH * 1000) / rate;
const batchCount = Math.round((durationS * 1000) / intervalMs);

const { DATABASE_URL, BASE_URL = 'http://127.0.0.1:3000' } = process.env;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set (the local web2 database, see docs/LOAD-TEST.md)');
  process.exit(2);
}
try {
  assertLocal(BASE_URL);
  assertLocal(DATABASE_URL);
} catch (err) {
  console.error(`Refused: ${err.message}`);
  process.exit(2);
}

const pool = createPool(DATABASE_URL);
try {
  const target = await pool.query(
    `SELECT k.key, e.id AS environment_id, x.id AS experiment_id, f.id AS flag_id
       FROM projects p
       JOIN environments e ON e.project_id = p.id AND e.name = 'dev'
       JOIN sdk_keys k ON k.environment_id = e.id
       JOIN flags f ON f.project_id = p.id AND f.key = $1
       JOIN experiments x ON x.flag_id = f.id AND x.environment_id = e.id
      WHERE p.name = 'ParkingLot'
      ORDER BY k.created_at, k.key
      LIMIT 1`,
    [FLAG_KEY],
  );
  if (target.rowCount === 0) throw new Error('ParkingLot dev not found: run `docker compose exec server npm run seed` first');
  const { key, environment_id: envId, experiment_id: expId, flag_id: flagId } = target.rows[0];

  const counts = async () => {
    const r = await pool.query(
      `SELECT (SELECT count(*) FROM ingested_events WHERE environment_id = $1)::int AS ingested_events,
              (SELECT count(*) FROM exposures WHERE experiment_id = $2)::int AS exposures,
              (SELECT count(*) FROM conversions WHERE experiment_id = $2)::int AS conversions,
              pg_total_relation_size('ingested_events')::bigint AS ingested_bytes,
              (SELECT last_evaluated_at FROM flag_environments WHERE flag_id = $3 AND environment_id = $1) AS last_evaluated_at`,
      [envId, expId, flagId],
    );
    return r.rows[0];
  };

  const before = await counts();
  const runId = randomBytes(8).toString('hex');
  const eventsUrl = `${BASE_URL}/sdk/events?key=${encodeURIComponent(key)}`;
  const configUrl = `${BASE_URL}/sdk/config?key=${encodeURIComponent(key)}`;
  console.log(`run ${runId}: ${batchCount} batches of ${EVENTS_PER_BATCH} every ${intervalMs} ms (${rate} events/s, ${durationS} s) → ${BASE_URL}`);

  // → { status, latencyMs }; status 'error' when there is no response (network, timeout).
  const timed = async (url, init) => {
    const start = performance.now();
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
      await res.arrayBuffer();
      return { status: res.status, latencyMs: performance.now() - start };
    } catch {
      return { status: 'error', latencyMs: performance.now() - start };
    }
  };

  // GET /sdk/config once a second while sending: does ingest hold up config reads (Q-031)?
  const probes = [];
  let sending = true;
  const probing = (async () => {
    while (sending) {
      probes.push(timed(configUrl));
      await sleep(PROBE_MS);
    }
  })();

  const t0 = performance.now();
  const pending = [];
  for (let seq = 0; seq < batchCount; seq++) {
    const scheduled = t0 + seq * intervalMs;
    const wait = scheduled - performance.now();
    if (wait > 0) await sleep(wait);
    const sentAt = performance.now();
    const body = JSON.stringify({ events: makeBatch(runId, seq) });
    pending.push(
      timed(eventsUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).then((r) => ({
        ...r,
        sentAt: sentAt - t0,
        lagMs: sentAt - scheduled,
      })),
    );
  }
  sending = false;
  const results = await Promise.all(pending);
  await probing;
  const probeResults = await Promise.all(probes);

  const after = await counts();
  const summary = summarize({ results, intervalMs, eventsPerBatch: EVENTS_PER_BATCH });
  const deltas = {
    ingested_events: after.ingested_events - before.ingested_events,
    exposures: after.exposures - before.exposures,
    conversions: after.conversions - before.conversions,
  };
  const expected = expectedDeltas(summary.acceptedBatches);
  const result = verdict(summary, deltas, expected);
  const grownBytes = Number(after.ingested_bytes) - Number(before.ingested_bytes);
  const probeStatus = {};
  for (const p of probeResults) probeStatus[p.status] = (probeStatus[p.status] ?? 0) + 1;

  const round = (n) => (n === null ? null : Math.round(n * 10) / 10);
  const report = {
    runId,
    target: { baseUrl: BASE_URL, environment: 'ParkingLot dev', rate, durationS, intervalMs, batchCount },
    events: {
      sent: summary.sentEvents,
      accepted: summary.acceptedEvents,
      throughputPerS: round(summary.throughput),
      sendWindowS: round(summary.sendWindowS),
      completionS: round(summary.completionS),
      errors: summary.errors,
      errorRate: summary.errorRate,
      statusCounts: summary.statusCounts,
      latencyMs: Object.fromEntries(Object.entries(summary.latencyMs).map(([k, v]) => [k, round(v)])),
      maxSendLagMs: round(summary.maxLagMs),
    },
    configProbe: {
      requests: probeResults.length,
      statusCounts: probeStatus,
      latencyMs: Object.fromEntries(
        Object.entries(latencyStats(probeResults.map((p) => p.latencyMs).sort((a, b) => a - b))).map(([k, v]) => [k, round(v)]),
      ),
    },
    rows: { before: { ...before, ingested_bytes: Number(before.ingested_bytes) }, deltas, expected },
    ingestedEvents: {
      grownBytes,
      bytesPerEvent: deltas.ingested_events > 0 ? round(grownBytes / deltas.ingested_events) : null,
      lastEvaluatedAtMoved: String(after.last_evaluated_at) !== String(before.last_evaluated_at),
    },
    verdict: result.pass ? 'PASS' : 'FAIL',
    failures: result.failures,
  };
  console.log(JSON.stringify(report, null, 2));
  console.log(result.pass ? 'PASS' : `FAIL: ${result.failures.join('; ')}`);
  process.exitCode = result.pass ? 0 : 1;
} catch (err) {
  console.error(`load test: ${err.message}`);
  process.exitCode = 2;
} finally {
  await pool.end();
}
