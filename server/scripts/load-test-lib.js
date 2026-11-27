// The pure parts of the ingest load test (scripts/load-test.js, docs/LOAD-TEST.md):
// the loopback guard, the batches, the statistics and the PASS / FAIL rule.

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '[::1]']);

// The test only ever runs on the local Docker stack, never on Neon or Render (D-016).
// Throws for any other host; the message names the host only, never the password.
export function assertLocal(url) {
  const { hostname } = new URL(url);
  if (!LOOPBACK.has(hostname)) throw new Error(`${hostname} is not local (127.0.0.1 or localhost only)`);
}

export const FLAG_KEY = 'reserve-button-color';
export const METRIC = 'reserve_click';
const USERS = 10; // exposures per batch; the first 9 users also convert

// One batch of 20 events (the SDK's batch size, D-011): 10 exposures for 10 new users,
// a conversion for 9 of them, and 1 evaluations event. Ids are unique per run and batch.
export function makeBatch(runId, seq) {
  const prefix = `lt-${runId}-${seq}`;
  const user = (u) => `${prefix}-u${u}`;
  const events = [];
  for (let u = 0; u < USERS; u++) {
    events.push({ id: `${prefix}-e${u}`, type: 'exposure', userId: user(u), flagKey: FLAG_KEY, variant: u % 2 ? 'green' : 'blue' });
  }
  for (let u = 0; u < USERS - 1; u++) {
    events.push({ id: `${prefix}-c${u}`, type: 'conversion', userId: user(u), metric: METRIC });
  }
  events.push({ id: `${prefix}-v`, type: 'evaluations', counts: { [FLAG_KEY]: USERS } });
  return events;
}

// Nearest-rank percentile of an ascending array; null when it is empty.
export function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  return sorted[Math.max(1, Math.ceil((p / 100) * sorted.length)) - 1];
}

// results: one { sentAt, status (number, or 'error' for no response), latencyMs, lagMs }
// per batch, sentAt in ms. Throughput = accepted events per second of the send window
// (first send to last send, plus one interval), so a server that keeps up with 1,000
// events/s scores 1,000; a slow response shows in the latency instead.
export function summarize({ results, intervalMs, eventsPerBatch }) {
  const batches = results.length;
  const accepted = results.filter((r) => r.status === 204).length;
  const statusCounts = {};
  for (const r of results) statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  const latencies = results.map((r) => r.latencyMs).sort((a, b) => a - b);

  let windowMs = 0;
  let completionMs = 0;
  if (batches > 0) {
    const first = Math.min(...results.map((r) => r.sentAt));
    windowMs = Math.max(...results.map((r) => r.sentAt)) - first + intervalMs;
    completionMs = Math.max(...results.map((r) => r.sentAt + r.latencyMs)) - first;
  }
  return {
    batches,
    sentEvents: batches * eventsPerBatch,
    acceptedBatches: accepted,
    acceptedEvents: accepted * eventsPerBatch,
    sendWindowS: windowMs / 1000,
    completionS: completionMs / 1000,
    throughput: windowMs === 0 ? 0 : (accepted * eventsPerBatch * 1000) / windowMs,
    errors: batches - accepted,
    errorRate: batches === 0 ? 0 : (batches - accepted) / batches,
    statusCounts,
    latencyMs: latencyStats(latencies),
    maxLagMs: batches === 0 ? null : Math.max(...results.map((r) => r.lagMs)),
  };
}

// p50 / p95 / p99 / max of an ascending array of milliseconds.
export function latencyStats(sorted) {
  return {
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted.length === 0 ? null : sorted[sorted.length - 1],
  };
}

// The rows each accepted batch adds (C-003): one ingested_events row per event id, one
// exposure per new user, one conversion per user exposed earlier in the batch.
export function expectedDeltas(acceptedBatches) {
  return { ingested_events: acceptedBatches * 20, exposures: acceptedBatches * USERS, conversions: acceptedBatches * (USERS - 1) };
}

export const TARGET_RATE = 1000; // events/s
export const MAX_P99_MS = 1000;

// The pass rule approved in the plan: ≥ 1,000 accepted events/s, 0 errors, p99 < 1 s,
// and the row counts grew by exactly what was accepted.
export function verdict(summary, deltas, expected) {
  const failures = [];
  if (!(summary.throughput >= TARGET_RATE)) failures.push(`throughput ${summary.throughput} events/s < ${TARGET_RATE}`);
  if (summary.errors > 0) failures.push(`${summary.errors} errors (non-204 or no response)`);
  const p99 = summary.latencyMs.p99;
  if (p99 === null || p99 >= MAX_P99_MS) failures.push(`p99 ${p99} ms ≥ ${MAX_P99_MS} ms`);
  for (const [table, n] of Object.entries(expected)) {
    if (deltas[table] !== n) failures.push(`${table} +${deltas[table]}, expected +${n}`);
  }
  return { pass: failures.length === 0, failures };
}
