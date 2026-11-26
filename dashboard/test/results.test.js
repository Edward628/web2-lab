import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  intRo,
  percent,
  pp,
  ciText,
  pText,
  valueText,
  convertedText,
  sampleText,
  barWidth,
  experimentVerdict,
  badge,
  resultCell,
  metaParts,
  summary,
  methodText,
  footerText,
  emptyTitle,
} from '../src/results.js';

// The copy of DS-web2-experiment (approved 2026-11-26), as pure functions over the
// C-007 results. Copy is a list of parts: a string is text, {code} a variant in <code>.
// `text` flattens it with backticks around code, so the tests read like the mock.
const text = (parts) => (Array.isArray(parts) ? parts : [parts]).map((p) => (typeof p === 'string' ? p : `\`${p.code}\``)).join('');

const comparison = (over = {}) => ({
  variant: 'green',
  difference: 0.15714285714285714,
  ci: { low: -0.1653059690230549, high: 0.47959168330876917 },
  pValue: 0.34408468688062616,
  minSampleReached: false,
  significant: false,
  peeking: false,
  ...over,
});
const experiment = (over = {}) => ({
  flagKey: 'reserve-button-color',
  metric: 'reserve_click',
  baseline: 0.2,
  mde: 0.1,
  minSample: 294,
  control: 'blue',
  variants: [
    { value: 'blue', exposed: 15, converted: 3, rate: 0.2 },
    { value: 'green', exposed: 14, converted: 5, rate: 5 / 14 },
  ],
  comparisons: [comparison()],
  ...over,
});

// The significant and peeking cases of the mock (numbers from server/src/stats.js).
const significant = experiment({
  variants: [
    { value: 'blue', exposed: 1000, converted: 200, rate: 0.2 },
    { value: 'green', exposed: 1000, converted: 240, rate: 0.24 },
  ],
  comparisons: [comparison({
    difference: 0.03999999999999998,
    ci: { low: 0.003732721356494509, high: 0.07626727864350545 },
    pValue: 0.030837167828904333,
    minSampleReached: true,
    significant: true,
  })],
});
const peeking = experiment({
  variants: [
    { value: 'blue', exposed: 100, converted: 10, rate: 0.1 },
    { value: 'green', exposed: 100, converted: 22, rate: 0.22 },
  ],
  comparisons: [comparison({
    difference: 0.12,
    ci: { low: 0.019754021153286005, high: 0.22024597884671399 },
    pValue: 0.0206375582439722,
    peeking: true,
  })],
});

// --- numbers -------------------------------------------------------------------------

test('intRo groups thousands with a dot', () => {
  assert.equal(intRo(0), '0');
  assert.equal(intRo(294), '294');
  assert.equal(intRo(1000), '1.000');
  assert.equal(intRo(1234567), '1.234.567');
});

test('percent: one decimal with a comma; no rate is a dash', () => {
  assert.equal(percent(0.2), '20,0%');
  assert.equal(percent(5 / 14), '35,7%');
  assert.equal(percent(1), '100,0%');
  assert.equal(percent(0), '0,0%');
  assert.equal(percent(null), '—');
});

test('pp: signed percentage points with a real minus; zero has no sign', () => {
  assert.equal(pp(0.15714285714285714), '+15,7 pp');
  assert.equal(pp(0.03999999999999998), '+4,0 pp');
  assert.equal(pp(-0.011), '−1,1 pp');
  assert.equal(pp(-0.0004), '0,0 pp');
  assert.equal(pp(0), '0,0 pp');
  assert.equal(pp(null), '—');
});

test('ciText: both ends signed, one unit', () => {
  assert.equal(ciText({ low: -0.1653059690230549, high: 0.47959168330876917 }), '−16,5 … +48,0 pp');
  assert.equal(ciText({ low: 0.003732721356494509, high: 0.07626727864350545 }), '+0,4 … +7,6 pp');
  assert.equal(ciText(null), '—');
});

test('pText: three decimals; under 0.001 is "< 0,001"; no p-value is a dash', () => {
  assert.equal(pText(0.34408468688062616), '0,344');
  assert.equal(pText(0.030837167828904333), '0,031');
  assert.equal(pText(0.0009), '< 0,001');
  assert.equal(pText(null), '—');
});

test('valueText: strings as they are, other values as JSON', () => {
  assert.equal(valueText('blue'), 'blue');
  assert.equal(valueText(true), 'true');
  assert.equal(valueText(3), '3');
});

// --- a variant ---------------------------------------------------------------------------

test('convertedText: "X din N utilizatori expuși au convertit", Romanian plurals and "de"', () => {
  assert.equal(convertedText({ exposed: 15, converted: 3 }), '3 din 15 utilizatori expuși au convertit');
  assert.equal(convertedText({ exposed: 1000, converted: 200 }), '200 din 1.000 de utilizatori expuși au convertit');
  assert.equal(convertedText({ exposed: 4, converted: 1 }), '1 din 4 utilizatori expuși a convertit');
  assert.equal(convertedText({ exposed: 1, converted: 0 }), '0 din 1 utilizator expus a convertit');
  assert.equal(convertedText({ exposed: 0, converted: 0 }), 'Niciun utilizator expus încă');
});

test('sampleText: progress toward the minimum sample, or reached', () => {
  assert.equal(sampleText(15, 294), '15 din 294 de utilizatori expuși pentru eșantionul minim');
  assert.equal(sampleText(0, 294), '0 din 294 de utilizatori expuși pentru eșantionul minim');
  assert.equal(sampleText(5, 12), '5 din 12 utilizatori expuși pentru eșantionul minim');
  assert.equal(sampleText(294, 294), 'Eșantionul minim (294) e atins');
  assert.equal(sampleText(1000, 294), 'Eșantionul minim (294) e atins');
});

test('barWidth: percent of the minimum sample, rounded, at most 100', () => {
  assert.deepEqual([15, 100, 200, 198, 4, 0, 294, 1000].map((n) => barWidth(n, 294)), [5, 34, 68, 67, 1, 0, 100, 100]);
});

// --- verdicts ------------------------------------------------------------------------------

test('experimentVerdict: significant if any comparison is; else peeking if any is; else not yet', () => {
  assert.equal(experimentVerdict(significant), 'significant');
  assert.equal(experimentVerdict(peeking), 'peeking');
  assert.equal(experimentVerdict(experiment()), 'not-yet');
  assert.equal(experimentVerdict(experiment({ comparisons: [] })), 'not-yet');
  const mixed = experiment({ comparisons: [comparison({ peeking: true }), comparison({ significant: true, minSampleReached: true })] });
  assert.equal(experimentVerdict(mixed), 'significant');
});

test('badge and result cell: an icon and text for every verdict, never colour alone', () => {
  assert.deepEqual(badge('significant'), { kind: 'ok', icon: '✓', text: 'Semnificativ' });
  assert.deepEqual(badge('peeking'), { kind: 'warn', icon: '⚠', text: 'Nu e semnificativ încă · peeking' });
  assert.deepEqual(badge('not-yet'), { kind: 'warn', icon: '◷', text: 'Nu e semnificativ încă' });
  assert.deepEqual(resultCell(significant.comparisons[0]), { kind: 'ok', icon: '✓', text: 'Semnificativ' });
  assert.deepEqual(resultCell(peeking.comparisons[0]), { kind: 'warn', icon: '⚠', text: 'Peeking · nu e semnificativ încă' });
  assert.deepEqual(resultCell(comparison()), { kind: 'warn', icon: '◷', text: 'Nu e semnificativ încă' });
});

test('metaParts: the metric and the control, in code', () => {
  assert.equal(text(metaParts(experiment())), 'Metrica `reserve_click` · control `blue` (valoarea implicită)');
  assert.equal(text(metaParts(experiment({ control: false }))), 'Metrica `reserve_click` · control `false` (valoarea implicită)');
});

// --- the summary under the tiles -------------------------------------------------------------

test('summary, not significant yet (the real case)', () => {
  const s = summary(experiment());
  assert.equal(s.kind, 'warn');
  assert.equal(s.icon, '◷');
  assert.equal(s.title, 'Nu e semnificativ încă.');
  assert.equal(text(s.body),
    'Diferența de +15,7 pp poate fi întâmplătoare (p = 0,344, peste 0,05), iar eșantionul minim nu e atins: ' +
    '15 și 14 din 294 de utilizatori expuși per variantă. Lasă experimentul să ruleze.');
});

test('summary, significant', () => {
  const s = summary(significant);
  assert.deepEqual([s.kind, s.icon, s.title], ['success', '✓', 'Semnificativ.']);
  assert.equal(text(s.body),
    '`green` convertește cu +4,0 pp față de control (IC 95%: +0,4 … +7,6 pp), p = 0,031, cu eșantionul minim atins în ambele variante.');
});

test('summary, peeking warning', () => {
  const s = summary(peeking);
  assert.deepEqual([s.kind, s.icon, s.title], ['warn', '⚠', 'Avertisment de peeking.']);
  assert.equal(text(s.body),
    'p = 0,021 e sub 0,05, dar eșantionul minim nu e atins: 100 și 100 din 294 de utilizatori expuși per variantă. ' +
    'Un p mic văzut devreme apare des din întâmplare, deci rezultatul rămâne „nu e semnificativ încă”. ' +
    'Nu opri experimentul acum; așteaptă eșantionul minim.');
});

test('summary, a variant with no exposed users', () => {
  const zero = experiment({
    variants: [
      { value: 'blue', exposed: 4, converted: 1, rate: 0.25 },
      { value: 'green', exposed: 0, converted: 0, rate: null },
    ],
    comparisons: [comparison({ difference: null, ci: null, pValue: null })],
  });
  const s = summary(zero);
  assert.deepEqual([s.kind, s.icon, s.title], ['warn', '◷', 'Nu e semnificativ încă.']);
  assert.equal(text(s.body),
    '`green` nu are încă utilizatori expuși, deci nu se poate compara cu controlul. ' +
    'Utilizatorii expuși apar după ce aplicațiile cu SDK-ul afișează varianta.');
  // The control without exposed users is named the same way.
  const noControl = experiment({
    variants: [
      { value: 'blue', exposed: 0, converted: 0, rate: null },
      { value: 'green', exposed: 3, converted: 1, rate: 1 / 3 },
    ],
    comparisons: [comparison({ difference: null, ci: null, pValue: null })],
  });
  assert.match(text(summary(noControl).body), /^`blue` nu are încă utilizatori expuși/);
});

test('summary, 3 variants, none significant', () => {
  const many = experiment({
    variants: [
      { value: 'blue', exposed: 200, converted: 40, rate: 0.2 },
      { value: 'green', exposed: 198, converted: 50, rate: 50 / 198 },
      { value: 'orange', exposed: 201, converted: 38, rate: 38 / 201 },
    ],
    comparisons: [comparison({ pValue: 0.2104 }), comparison({ variant: 'orange', pValue: 0.7819 })],
  });
  const s = summary(many);
  assert.equal(s.title, 'Nu e semnificativ încă.');
  assert.equal(text(s.body), 'Nicio variantă nu diferă semnificativ de control (p peste 0,05), iar eșantionul minim nu e atins. Lasă experimentul să ruleze.');
});

test('summary, not significant with the minimum sample reached', () => {
  const reached = experiment({
    variants: [
      { value: 'blue', exposed: 400, converted: 80, rate: 0.2 },
      { value: 'green', exposed: 400, converted: 88, rate: 0.22 },
    ],
    comparisons: [comparison({ difference: 0.02, pValue: 0.48, minSampleReached: true })],
  });
  assert.equal(text(summary(reached).body),
    'Diferența de +2,0 pp poate fi întâmplătoare (p = 0,480, peste 0,05), cu eșantionul minim atins. Lasă experimentul să ruleze.');
});

test('summary, no p-value because both variants have the same 0% or 100% rate', () => {
  const flat = experiment({
    variants: [
      { value: 'blue', exposed: 5, converted: 0, rate: 0 },
      { value: 'green', exposed: 6, converted: 0, rate: 0 },
    ],
    comparisons: [comparison({ difference: 0, ci: { low: 0, high: 0 }, pValue: null })],
  });
  assert.equal(text(summary(flat).body), 'Ambele variante au rata 0,0%, deci nu există încă o diferență de testat. Lasă experimentul să ruleze.');
});

test('summary, only the control (nothing to compare)', () => {
  const alone = experiment({ variants: [{ value: 'blue', exposed: 7, converted: 2, rate: 2 / 7 }], comparisons: [] });
  assert.equal(text(summary(alone).body), 'Experimentul are doar controlul, deci nu are cu ce să-l compare.');
});

// --- method line, footer, empty ----------------------------------------------------------------

test('methodText: the test, α, power, minimum sample with baseline and MDE; the note on 3+ variants', () => {
  assert.equal(methodText(experiment()),
    'Test z pe două proporții, α = 0,05, putere 80%. Eșantion minim: 294 de utilizatori expuși per variantă, ' +
    'pentru rata de bază 20% și efectul minim detectabil +10 pp.');
  assert.equal(methodText(experiment({ baseline: 0.125, mde: 0.05, minSample: 1600 })),
    'Test z pe două proporții, α = 0,05, putere 80%. Eșantion minim: 1.600 de utilizatori expuși per variantă, ' +
    'pentru rata de bază 12,5% și efectul minim detectabil +5 pp.');
  const three = experiment({ variants: [...experiment().variants, { value: 'orange', exposed: 1, converted: 0, rate: 0 }] });
  assert.match(methodText(three),
    / Fiecare variantă e comparată separat cu controlul, fără corecție pentru comparații multiple: cu mai multe variante, un p sub 0,05 apare mai ușor din întâmplare\.$/);
});

test('footer and empty title', () => {
  assert.equal(footerText(1, 'prod'), '1 experiment în prod');
  assert.equal(footerText(2, 'dev'), '2 experimente în dev');
  assert.equal(footerText(20, 'dev'), '20 de experimente în dev');
  assert.equal(emptyTitle('prod'), 'Niciun experiment în prod');
});
