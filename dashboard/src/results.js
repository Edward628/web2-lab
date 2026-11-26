// The copy of the experiment results screen (DS-web2-experiment, approved 2026-11-26), as
// pure functions over the C-007 results (D-001, D-021), so they can be tested without a
// browser. Copy is a list of parts: a string is text, { code } goes into a <code> element.
import { countRo, needsDe } from './flags.js';

const MINUS = '−';
const comma = (s) => s.replace('.', ',');

// 1000 → "1.000"
export const intRo = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// 0.2 → "20,0%"; null → "—"
export const percent = (rate) => (rate === null ? '—' : `${comma((rate * 100).toFixed(1))}%`);

// Signed, one decimal, with a real minus; a value that rounds to 0 has no sign.
function signed(points) {
  const rounded = Math.round(points * 10) / 10;
  if (rounded === 0) return '0,0';
  return `${rounded > 0 ? '+' : MINUS}${comma(Math.abs(rounded).toFixed(1))}`;
}

// 0.04 → "+4,0 pp"
export const pp = (difference) => (difference === null ? '—' : `${signed(difference * 100)} pp`);

export const ciText = (ci) => (ci === null ? '—' : `${signed(ci.low * 100)} … ${signed(ci.high * 100)} pp`);

export const pText = (p) => (p === null ? '—' : p < 0.001 ? '< 0,001' : comma(p.toFixed(3)));
const pEquals = (p) => (p < 0.001 ? 'p < 0,001' : `p = ${pText(p)}`);

export const valueText = (value) => (typeof value === 'string' ? value : JSON.stringify(value));

// "1.000 de utilizatori expuși", "15 utilizatori expuși", "1 utilizator expus"
const users = (n) => (n === 1 ? '1 utilizator expus' : `${intRo(n)} ${needsDe(n) ? 'de ' : ''}utilizatori expuși`);

export function convertedText({ exposed, converted }) {
  if (exposed === 0) return 'Niciun utilizator expus încă';
  return `${converted} din ${users(exposed)} ${converted === 1 || exposed === 1 ? 'a' : 'au'} convertit`;
}

export function sampleText(exposed, minSample) {
  if (exposed >= minSample) return `Eșantionul minim (${intRo(minSample)}) e atins`;
  return `${intRo(exposed)} din ${users(minSample)} pentru eșantionul minim`;
}

export const barWidth = (exposed, minSample) => Math.min(100, Math.round((exposed / minSample) * 100));

// 'significant' | 'peeking' | 'not-yet' for the whole experiment.
export function experimentVerdict({ comparisons }) {
  if (comparisons.some((c) => c.significant)) return 'significant';
  if (comparisons.some((c) => c.peeking)) return 'peeking';
  return 'not-yet';
}

const BADGES = {
  significant: { kind: 'ok', icon: '✓', text: 'Semnificativ' },
  peeking: { kind: 'warn', icon: '⚠', text: 'Nu e semnificativ încă · peeking' },
  'not-yet': { kind: 'warn', icon: '◷', text: 'Nu e semnificativ încă' },
};
export const badge = (verdict) => BADGES[verdict];

export function resultCell(comparison) {
  if (comparison.significant) return { kind: 'ok', icon: '✓', text: 'Semnificativ' };
  if (comparison.peeking) return { kind: 'warn', icon: '⚠', text: 'Peeking · nu e semnificativ încă' };
  return { kind: 'warn', icon: '◷', text: 'Nu e semnificativ încă' };
}

export const metaParts = (experiment) => [
  'Metrica ',
  { code: experiment.metric },
  ' · control ',
  { code: valueText(experiment.control) },
  ' (valoarea implicită)',
];

const KEEP_RUNNING = 'Lasă experimentul să ruleze.';
const rowOf = (experiment, value) => experiment.variants.find((v) => valueText(v.value) === valueText(value));

// The sentence under the tiles: { kind: 'success' | 'warn', icon, title, body: parts }.
export function summary(experiment) {
  const { comparisons, minSample } = experiment;
  const control = rowOf(experiment, experiment.control);
  const verdict = experimentVerdict(experiment);
  const notYet = (body) => ({ kind: 'warn', icon: '◷', title: 'Nu e semnificativ încă.', body });

  if (verdict === 'significant') {
    const body = [];
    for (const c of comparisons.filter((x) => x.significant)) {
      if (body.length > 0) body.push(' ');
      body.push({ code: valueText(c.variant) },
        ` convertește cu ${pp(c.difference)} față de control (IC 95%: ${ciText(c.ci)}), ${pEquals(c.pValue)}, cu eșantionul minim atins în ambele variante.`);
    }
    return { kind: 'success', icon: '✓', title: 'Semnificativ.', body };
  }
  if (verdict === 'peeking') {
    const c = comparisons.find((x) => x.peeking);
    const row = rowOf(experiment, c.variant);
    return {
      kind: 'warn',
      icon: '⚠',
      title: 'Avertisment de peeking.',
      body: [
        `${pEquals(c.pValue)} e sub 0,05, dar eșantionul minim nu e atins: ${intRo(control.exposed)} și ${intRo(row.exposed)} din ` +
          `${users(minSample)} per variantă. Un p mic văzut devreme apare des din întâmplare, deci rezultatul rămâne ` +
          '„nu e semnificativ încă”. Nu opri experimentul acum; așteaptă eșantionul minim.',
      ],
    };
  }
  if (comparisons.length === 0) return notYet(['Experimentul are doar controlul, deci nu are cu ce să-l compare.']);

  const empty = experiment.variants.find((v) => v.exposed === 0);
  if (empty) {
    return notYet([
      { code: valueText(empty.value) },
      ' nu are încă utilizatori expuși, deci nu se poate compara cu controlul. Utilizatorii expuși apar după ce aplicațiile cu SDK-ul afișează varianta.',
    ]);
  }
  const allReached = comparisons.every((c) => c.minSampleReached);
  if (comparisons.length > 1) {
    const sample = allReached ? ', cu eșantionul minim atins.' : ', iar eșantionul minim nu e atins.';
    return notYet([`Nicio variantă nu diferă semnificativ de control (p peste 0,05)${sample} ${KEEP_RUNNING}`]);
  }
  const [c] = comparisons;
  const row = rowOf(experiment, c.variant);
  if (c.pValue === null) {
    return notYet([`Ambele variante au rata ${percent(control.rate)}, deci nu există încă o diferență de testat. ${KEEP_RUNNING}`]);
  }
  const sample = c.minSampleReached
    ? ', cu eșantionul minim atins.'
    : `, iar eșantionul minim nu e atins: ${intRo(control.exposed)} și ${intRo(row.exposed)} din ${users(minSample)} per variantă.`;
  return notYet([`Diferența de ${pp(c.difference)} poate fi întâmplătoare (${pEquals(c.pValue)}, peste 0,05)${sample} ${KEEP_RUNNING}`]);
}

// 0.2 → "20", 0.125 → "12,5" (percent, at most one decimal)
const plain = (fraction) => comma(String(Math.round(fraction * 1000) / 10));

export function methodText(experiment) {
  const text =
    `Test z pe două proporții, α = 0,05, putere 80%. Eșantion minim: ${users(experiment.minSample)} per variantă, ` +
    `pentru rata de bază ${plain(experiment.baseline)}% și efectul minim detectabil +${plain(experiment.mde)} pp.`;
  if (experiment.variants.length < 3) return text;
  return `${text} Fiecare variantă e comparată separat cu controlul, fără corecție pentru comparații multiple: cu mai multe variante, un p sub 0,05 apare mai ușor din întâmplare.`;
}

export const footerText = (count, env) => `${countRo(count, 'experiment', 'experimente')} în ${env}`;

export const emptyTitle = (env) => `Niciun experiment în ${env}`;
