// The statistics of the experiment results (D-001, D-021): two-proportion z-test,
// α = 0.05 two-sided, power 80%. No dependency: the normal CDF comes from erfc, and the
// two quantiles are constants because α and the power are fixed.
const Z_975 = 1.959963984540054; // z for α = 0.05 two-sided
const Z_80 = 0.8416212335729143; // z for power 80%
const ALPHA = 0.05;

// erfc with fractional error < 1.2e-7 everywhere (Chebyshev fit, Numerical Recipes
// "erfcc"), so p-values keep that relative precision even far in the tail.
function erfc(x) {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z - 1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 +
        t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

export const normalCdf = (z) => 0.5 * erfc(-z / Math.SQRT2);

// Users needed per variant to detect baseline → baseline + mde (D-021):
// ⌈(z.975·√(2p̄q̄) + z.8·√(p₁q₁ + p₂q₂))² / δ²⌉, p̄ = (p₁ + p₂) / 2.
export function minSample(baseline, mde) {
  const p1 = baseline;
  const p2 = baseline + mde;
  const pBar = (p1 + p2) / 2;
  const a = Z_975 * Math.sqrt(2 * pBar * (1 - pBar));
  const b = Z_80 * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  return Math.ceil((a + b) ** 2 / mde ** 2);
}

// Treatment − control, each { exposed, converted }. The p-value uses the pooled SE; the
// 95% CI the unpooled (Wald) SE. No exposed users in a group → all null; a pooled SE of
// 0 (0% or 100% in both groups) → no p-value.
export function compare(control, treatment) {
  if (control.exposed === 0 || treatment.exposed === 0) return { difference: null, ci: null, pValue: null };
  const r1 = control.converted / control.exposed;
  const r2 = treatment.converted / treatment.exposed;
  const difference = r2 - r1;
  const pooled = (control.converted + treatment.converted) / (control.exposed + treatment.exposed);
  const sePooled = Math.sqrt(pooled * (1 - pooled) * (1 / control.exposed + 1 / treatment.exposed));
  const pValue = sePooled === 0 ? null : erfc(Math.abs(difference / sePooled) / Math.SQRT2);
  const se = Math.sqrt((r1 * (1 - r1)) / control.exposed + (r2 * (1 - r2)) / treatment.exposed);
  return { difference, ci: { low: difference - Z_975 * se, high: difference + Z_975 * se }, pValue };
}

// D-001: significant only with p < 0.05 and the minimum sample reached; p < 0.05 before
// it is peeking; anything else is "nu e semnificativ încă".
export function verdict(pValue, minSampleReached) {
  const below = pValue !== null && pValue < ALPHA;
  return { significant: below && minSampleReached, peeking: below && !minSampleReached };
}
