import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBatch } from '../src/events.js';
import {
  assertLocal,
  makeBatch,
  percentile,
  summarize,
  expectedDeltas,
  verdict,
} from '../scripts/load-test-lib.js';

// The pure parts of the ingest load test (docs/LOAD-TEST.md); no database here.

test('assertLocal accepts only loopback hosts, for HTTP and PostgreSQL URLs', () => {
  for (const url of [
    'http://127.0.0.1:3000',
    'http://localhost:3000',
    'postgres://postgres:secret@127.0.0.1:5432/web2',
    'postgres://postgres:secret@localhost:5432/web2',
  ]) {
    assert.doesNotThrow(() => assertLocal(url), url);
  }
  for (const url of [
    'https://web2-lab-0c75.onrender.com',
    'postgres://u:secret@ep-x-123.eu-central-1.aws.neon.tech/neondb?sslmode=verify-full',
    'http://192.168.1.10:3000',
    'http://127.0.0.1.example.com:3000',
    'http://db:5432',
  ]) {
    assert.throws(() => assertLocal(url), /not local/, url);
  }
});

test('assertLocal never puts the password in its error', () => {
  assert.throws(
    () => assertLocal('postgres://u:hunter2-secret@ep-x.neon.tech/neondb'),
    (err) => !err.message.includes('hunter2-secret'),
  );
});

test('assertLocal throws on a value that is not a URL', () => {
  assert.throws(() => assertLocal(undefined));
  assert.throws(() => assertLocal('not a url'));
});

test('makeBatch: 20 events, 10 exposures, 9 conversions, 1 evaluations, valid for C-003', () => {
  const batch = makeBatch('run1', 0);
  assert.equal(batch.length, 20);
  const byType = (t) => batch.filter((e) => e.type === t);
  assert.equal(byType('exposure').length, 10);
  assert.equal(byType('conversion').length, 9);
  assert.equal(byType('evaluations').length, 1);
  assert.deepEqual(validateBatch({ events: batch }), batch);

  // Every conversion comes after an exposure of the same user in the batch.
  batch.forEach((e, i) => {
    if (e.type !== 'conversion') return;
    assert.ok(batch.slice(0, i).some((x) => x.type === 'exposure' && x.userId === e.userId), e.id);
  });
  // Ten distinct users, one exposure each.
  assert.equal(new Set(byType('exposure').map((e) => e.userId)).size, 10);
});

test('makeBatch: ids and users are unique across batches and at most 64 characters', () => {
  const runId = 'a'.repeat(16);
  const ids = new Set();
  const users = new Set();
  for (let seq = 0; seq < 3000; seq++) {
    for (const e of makeBatch(runId, seq)) {
      assert.ok(e.id.length <= 64, e.id);
      assert.ok(!ids.has(e.id), e.id);
      ids.add(e.id);
      if (e.type === 'exposure') {
        assert.ok(!users.has(e.userId), e.userId);
        users.add(e.userId);
      }
    }
  }
  assert.equal(ids.size, 60000);
  assert.equal(users.size, 30000);
  // A second run never reuses the first run's ids.
  assert.ok(!ids.has(makeBatch('b'.repeat(16), 0)[0].id));
});

test('percentile: nearest rank on a sorted array; empty → null', () => {
  const hundred = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(percentile(hundred, 50), 50);
  assert.equal(percentile(hundred, 95), 95);
  assert.equal(percentile(hundred, 99), 99);
  assert.equal(percentile([1, 2, 3, 4], 50), 2);
  assert.equal(percentile([1, 2, 3, 4], 99), 4);
  assert.equal(percentile([7], 99), 7);
  assert.equal(percentile([], 50), null);
});

test('summarize: throughput over the send window, error rate, statuses, latency, lag', () => {
  // 4 batches of 20 every 20 ms (send window 4 × 20 ms = 80 ms); one 500 and one network error.
  const results = [
    { sentAt: 0, status: 204, latencyMs: 10, lagMs: 0 },
    { sentAt: 20, status: 204, latencyMs: 30, lagMs: 1 },
    { sentAt: 40, status: 500, latencyMs: 20, lagMs: 0 },
    { sentAt: 60, status: 'error', latencyMs: 40, lagMs: 3 },
  ];
  const s = summarize({ results, intervalMs: 20, eventsPerBatch: 20 });
  assert.equal(s.batches, 4);
  assert.equal(s.sentEvents, 80);
  assert.equal(s.acceptedBatches, 2);
  assert.equal(s.acceptedEvents, 40);
  assert.equal(s.sendWindowS, 0.08);
  assert.equal(s.completionS, 0.1); // first send → last response (60 + 40 ms)
  assert.equal(s.throughput, 500); // 40 accepted events / 0.08 s
  assert.equal(s.errors, 2);
  assert.equal(s.errorRate, 0.5);
  assert.deepEqual(s.statusCounts, { 204: 2, 500: 1, error: 1 });
  assert.deepEqual(s.latencyMs, { p50: 20, p95: 40, p99: 40, max: 40 });
  assert.equal(s.maxLagMs, 3);
});

test('summarize: no results → zero throughput and null latencies', () => {
  const s = summarize({ results: [], intervalMs: 20, eventsPerBatch: 20 });
  assert.equal(s.batches, 0);
  assert.equal(s.throughput, 0);
  assert.deepEqual(s.latencyMs, { p50: null, p95: null, p99: null, max: null });
});

test('expectedDeltas: 20 event ids, 10 exposures and 9 conversions per accepted batch', () => {
  assert.deepEqual(expectedDeltas(3000), { ingested_events: 60000, exposures: 30000, conversions: 27000 });
  assert.deepEqual(expectedDeltas(0), { ingested_events: 0, exposures: 0, conversions: 0 });
});

const passing = {
  throughput: 1000,
  errors: 0,
  latencyMs: { p50: 5, p95: 20, p99: 999, max: 1500 },
};
// Literal, so the verdict tests do not depend on expectedDeltas.
const counts = { ingested_events: 60000, exposures: 30000, conversions: 27000 };

test('verdict: PASS at ≥ 1,000 events/s, 0 errors, p99 < 1 s and matching row counts', () => {
  assert.deepEqual(verdict(passing, counts, counts), { pass: true, failures: [] });
});

test('verdict: each failing condition is named', () => {
  const v = (summary, deltas = counts) => verdict({ ...passing, ...summary }, deltas, counts);
  assert.deepEqual(v({ throughput: 999.9 }).failures, ['throughput 999.9 events/s < 1000']);
  assert.deepEqual(v({ errors: 1 }).failures, ['1 errors (non-204 or no response)']);
  assert.deepEqual(v({ latencyMs: { ...passing.latencyMs, p99: 1000 } }).failures, ['p99 1000 ms ≥ 1000 ms']);
  assert.deepEqual(v({ latencyMs: { ...passing.latencyMs, p99: null } }).failures, ['p99 null ms ≥ 1000 ms']);
  assert.deepEqual(v({}, { ...counts, conversions: 26999 }).failures, ['conversions +26999, expected +27000']);
  const all = v({ throughput: 0, errors: 3, latencyMs: { p99: 2000 } }, { ...counts, exposures: 1 });
  assert.equal(all.pass, false);
  assert.equal(all.failures.length, 4);
});
