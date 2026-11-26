import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalCdf, minSample, compare, verdict } from '../src/stats.js';

// The statistics of the experiment results (D-001, D-021): two-proportion z-test,
// α = 0.05 two-sided, power 80%. Reference values (PATTERN-002) were computed once with
// Python 3.14's standard library (statistics.NormalDist, math.erfc), outside the repo,
// after checking it on the published normal table: Φ(1.96) = 0.9750021048517795,
// z(0.975) = 1.959963984540054, z(0.8) = 0.8416212335729143; and 294 per variant for
// 20% vs 30% matches Fleiss' table without continuity correction.

// |actual − expected| ≤ tolerance × max(1, |expected|) for CI ends; p-values relative.
function near(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected)), `${message}: ${actual} ≠ ${expected}`);
}
function nearRelative(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance * Math.abs(expected), `${message}: ${actual} ≠ ${expected}`);
}

test('normalCdf matches the normal table', () => {
  near(normalCdf(1.96), 0.9750021048517795, 1e-7, 'Φ(1.96)');
  near(normalCdf(0), 0.5, 1e-7, 'Φ(0)');
  near(normalCdf(-1.96), 1 - 0.9750021048517795, 1e-7, 'Φ(−1.96)');
});

// --- 1. minimum sample per variant -------------------------------------------------

test('minSample: ⌈(z.975·√(2p̄q̄) + z.8·√(p₁q₁+p₂q₂))² / δ²⌉ per variant (D-021)', () => {
  assert.equal(minSample(0.2, 0.1), 294); // 293.1512855064867
  assert.equal(minSample(0.1, 0.05), 686); // 685.5968583253606
  assert.equal(minSample(0.5, 0.05), 1565); // 1564.6720527749524
  assert.equal(minSample(0.2, 0.05), 1094); // 1093.7390457661647
});

// --- 2. difference, 95% CI (Wald, unpooled SE) and p-value (pooled SE) -------------

const CASES = [
  // control, treatment, difference, CI low, CI high, p-value
  [[1000, 200], [1000, 240], 0.03999999999999998, 0.003732721356494509, 0.07626727864350545, 0.030837167828904333],
  [[100, 10], [100, 22], 0.12, 0.019754021153286005, 0.22024597884671399, 0.0206375582439722],
  [[150, 30], [150, 36], 0.03999999999999998, -0.053641710799040426, 0.1336417107990404, 0.40301876921121627],
  [[400, 50], [400, 30], -0.05, -0.09143249824108712, -0.008567501758912889, 0.01842212545409902],
  [[15, 3], [14, 5], 0.15714285714285714, -0.1653059690230549, 0.47959168330876917, 0.34408468688062616],
];

for (const [[n1, c1], [n2, c2], difference, low, high, pValue] of CASES) {
  test(`compare ${c1}/${n1} vs ${c2}/${n2}`, () => {
    const r = compare({ exposed: n1, converted: c1 }, { exposed: n2, converted: c2 });
    near(r.difference, difference, 1e-12, 'difference');
    near(r.ci.low, low, 1e-9, 'CI low');
    near(r.ci.high, high, 1e-9, 'CI high');
    nearRelative(r.pValue, pValue, 1e-6, 'p-value');
  });
}

test('compare: the p-value stays accurate far in the tail (relative 1e-6)', () => {
  // z = 5 exactly is not reachable from counts; check the tail through normalCdf instead:
  // 2·(1 − Φ(5)) = 5.733031437583891e-07, 2·(1 − Φ(3)) = 0.0026997960632601913.
  nearRelative(2 * normalCdf(-5), 5.733031437583891e-7, 1e-6, 'p(z=5)');
  nearRelative(2 * normalCdf(-3), 0.0026997960632601913, 1e-6, 'p(z=3)');
  nearRelative(2 * normalCdf(-1), 0.31731050786291415, 1e-6, 'p(z=1)');
});

// --- 3. edges ----------------------------------------------------------------------

test('compare: a group with no exposed users has no difference, CI or p-value', () => {
  const empty = { difference: null, ci: null, pValue: null };
  assert.deepEqual(compare({ exposed: 0, converted: 0 }, { exposed: 10, converted: 2 }), empty);
  assert.deepEqual(compare({ exposed: 10, converted: 2 }, { exposed: 0, converted: 0 }), empty);
  assert.deepEqual(compare({ exposed: 0, converted: 0 }, { exposed: 0, converted: 0 }), empty);
});

test('compare: 0% or 100% conversions in both groups (pooled SE 0) has no p-value; the CI is the difference', () => {
  assert.deepEqual(compare({ exposed: 10, converted: 0 }, { exposed: 12, converted: 0 }), {
    difference: 0,
    ci: { low: 0, high: 0 },
    pValue: null,
  });
  assert.deepEqual(compare({ exposed: 10, converted: 10 }, { exposed: 12, converted: 12 }), {
    difference: 0,
    ci: { low: 0, high: 0 },
    pValue: null,
  });
});

// --- 4. verdict ----------------------------------------------------------------------

test('verdict: significant only when p < 0.05 and the minimum sample is reached', () => {
  assert.deepEqual(verdict(0.03, true), { significant: true, peeking: false });
  assert.deepEqual(verdict(0.0499, true), { significant: true, peeking: false });
});

test('verdict: p < 0.05 before the minimum sample is a peeking warning, not significant', () => {
  assert.deepEqual(verdict(0.03, false), { significant: false, peeking: true });
});

test('verdict: p ≥ 0.05, or no p-value, is "not significant yet" without a warning', () => {
  for (const [p, reached] of [[0.05, true], [0.4, true], [0.4, false], [null, true], [null, false]]) {
    assert.deepEqual(verdict(p, reached), { significant: false, peeking: false }, `${p}, ${reached}`);
  }
});
