import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countRo,
  typeLabel,
  targetingSummary,
  needsConfirm,
  confirmCopy,
  successCopy,
  writeErrorCopy,
  undoOf,
  footerText,
  emptyTitle,
} from '../src/flags.js';

// The copy and summaries of DS-web2-flags (approved 2026-11-26), as pure functions.
// Copy is a list of parts: a string is text, {code} is a flag key or value in <code>.
// `text` flattens it with backticks around code, so the tests read like the mock.
const text = (parts) => parts.map((p) => (typeof p === 'string' ? p : `\`${p.code}\``)).join('');

const flag = (over = {}) => ({
  key: 'new-checkout',
  type: 'boolean',
  enabled: true,
  default: false,
  ruleCount: 0,
  variants: [],
  rollout: 0,
  ...over,
});

test('countRo: Romanian plurals, with "de" from 20 on (but not for 101–119)', () => {
  assert.equal(countRo(1, 'regulă', 'reguli'), '1 regulă');
  assert.equal(countRo(2, 'regulă', 'reguli'), '2 reguli');
  assert.equal(countRo(19, 'regulă', 'reguli'), '19 reguli');
  assert.equal(countRo(20, 'regulă', 'reguli'), '20 de reguli');
  assert.equal(countRo(0, 'flag', 'flag-uri'), '0 flag-uri');
  assert.equal(countRo(101, 'flag', 'flag-uri'), '101 flag-uri');
  assert.equal(countRo(120, 'flag', 'flag-uri'), '120 de flag-uri');
});

test('typeLabel: boolean, or multivariat with the number of variants', () => {
  assert.equal(typeLabel(flag()), 'boolean');
  const two = flag({ type: 'multivariate', variants: [{ value: 'blue', from: 0, to: 50 }, { value: 'green', from: 50, to: 100 }], rollout: null });
  assert.equal(typeLabel(two), 'multivariat · 2 variante');
  assert.equal(typeLabel({ ...two, variants: [two.variants[0]] }), 'multivariat · 1 variantă');
});

test('targetingSummary matches the mock: rules · rollout, allocation, or "fără reguli"', () => {
  assert.equal(targetingSummary(flag({ ruleCount: 1, variants: [{ value: true, from: 0, to: 10 }], rollout: 10 })), '1 regulă · rollout 10%');
  assert.equal(targetingSummary(flag({ ruleCount: 2, variants: [{ value: true, from: 0, to: 30 }], rollout: 30 })), '2 reguli · rollout 30%');
  assert.equal(targetingSummary(flag({ variants: [{ value: true, from: 0, to: 100 }], rollout: 100 })), 'rollout 100%');
  assert.equal(targetingSummary(flag({ variants: [{ value: true, from: 0, to: 0 }], rollout: 0 })), 'rollout 0%');
  assert.equal(targetingSummary(flag()), 'fără reguli');
  assert.equal(targetingSummary(flag({ ruleCount: 3 })), '3 reguli');
  const multi = flag({
    type: 'multivariate',
    variants: [{ value: 'blue', from: 0, to: 50 }, { value: 'green', from: 50, to: 100 }],
    rollout: null,
  });
  assert.equal(targetingSummary(multi), 'alocare 50 / 50');
  assert.equal(targetingSummary({ ...multi, ruleCount: 1 }), '1 regulă · alocare 50 / 50');
  // A boolean flag whose ranges are not one rollout (rollout null) shows its allocation.
  assert.equal(targetingSummary(flag({ variants: [{ value: true, from: 10, to: 40 }], rollout: null })), 'alocare 30');
});

test('needsConfirm: every change in prod asks, in both directions (D-004); dev never asks', () => {
  assert.equal(needsConfirm('prod'), true);
  assert.equal(needsConfirm('dev'), false);
});

test('confirmCopy to turn off: the mock text, with the default value, and a danger action', () => {
  const c = confirmCopy(flag(), false, 'prod');
  assert.equal(text(c.title), 'Oprești `new-checkout` în prod?');
  assert.equal(
    text(c.body),
    'Toți utilizatorii primesc imediat valoarea implicită (`false`). Schimbarea apare în jurnalul de audit și poate fi anulată.',
  );
  assert.equal(c.action, 'Oprește flag-ul');
  assert.equal(c.danger, true);
  assert.equal(text(confirmCopy(flag({ type: 'multivariate', default: 'blue' }), false, 'prod').body).includes('(`"blue"`)'), true);
});

test('confirmCopy to turn on: the mock text and a primary action', () => {
  const c = confirmCopy(flag({ key: 'dark-mode', enabled: false }), true, 'prod');
  assert.equal(text(c.title), 'Pornești `dark-mode` în prod?');
  assert.equal(
    text(c.body),
    'Utilizatorii primesc imediat valoarea dată de reguli și de rollout. Schimbarea apare în jurnalul de audit și poate fi anulată.',
  );
  assert.equal(c.action, 'Pornește flag-ul');
  assert.equal(c.danger, false);
});

test('successCopy: the approved text, with the environment and the version', () => {
  const off = successCopy(flag({ enabled: false }), 'prod', 48);
  assert.equal(off.title, 'Flag oprit.');
  assert.equal(
    text(off.body),
    '`new-checkout` e oprit în prod, în configurația v48. Aplicațiile conectate o primesc în cel mult 15 s; celelalte, la următoarea încărcare.',
  );
  const on = successCopy(flag({ key: 'dark-mode', enabled: true }), 'dev', 9);
  assert.equal(on.title, 'Flag pornit.');
  assert.equal(text(on.body).startsWith('`dark-mode` e pornit în dev, în configurația v9.'), true);
});

test('writeErrorCopy: what failed and that the flag kept its state', () => {
  const off = writeErrorCopy('new-checkout', false, 'prod');
  assert.equal(text(off.title), 'Nu am putut opri `new-checkout`.');
  assert.equal(off.body, 'Serverul nu a răspuns, deci flag-ul a rămas pornit în prod. Încearcă din nou.');
  const on = writeErrorCopy('dark-mode', true, 'dev');
  assert.equal(text(on.title), 'Nu am putut porni `dark-mode`.');
  assert.equal(on.body, 'Serverul nu a răspuns, deci flag-ul a rămas oprit în dev. Încearcă din nou.');
});

test('undoOf: the reverse change, same flag and environment', () => {
  assert.deepEqual(undoOf({ key: 'new-checkout', env: 'prod', enabled: false }), { key: 'new-checkout', env: 'prod', enabled: true });
  assert.deepEqual(undoOf({ key: 'x', env: 'dev', enabled: true }), { key: 'x', env: 'dev', enabled: false });
});

test('footerText and emptyTitle', () => {
  assert.equal(footerText(5, 'prod', 47), '5 flag-uri în prod · configurația v47');
  assert.equal(footerText(1, 'dev', 3), '1 flag în dev · configurația v3');
  assert.equal(emptyTitle('prod'), 'Niciun flag în prod');
  assert.equal(emptyTitle('dev'), 'Niciun flag în dev');
});
