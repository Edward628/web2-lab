import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  actionLabel,
  stateParts,
  timeText,
  versionText,
  subtitleText,
  captionText,
  footerParts,
  emptyTitleParts,
} from '../src/audit-text.js';

// The copy of DS-web2-audit (approved 2026-11-27), as pure functions over the C-007 audit
// entries. Copy is a list of parts: a string is text, {code} goes into <code>. `text`
// flattens it with backticks around code, so the tests read like the mock.
const text = (parts) => (Array.isArray(parts) ? parts : [parts]).map((p) => (typeof p === 'string' ? p : `\`${p.code}\``)).join('');

test('actions: an icon and a word, so color never carries the meaning alone', () => {
  assert.deepEqual(actionLabel('enable'), { kind: 'on', icon: '●', text: 'Pornit' });
  assert.deepEqual(actionLabel('disable'), { kind: 'off', icon: '■', text: 'Oprit (kill switch)' });
  assert.deepEqual(actionLabel('rollout'), { kind: '', icon: '%', text: 'Rollout' });
  assert.deepEqual(actionLabel('variants'), { kind: '', icon: '', text: 'variants' }, 'an unknown action shows as stored');
});

test('before / after of the switch: Pornit or Oprit', () => {
  assert.equal(text(stateParts('enable', { enabled: false })), 'Oprit');
  assert.equal(text(stateParts('enable', { enabled: true })), 'Pornit');
  assert.equal(text(stateParts('disable', { enabled: true })), 'Pornit');
  assert.equal(text(stateParts('disable', { enabled: false })), 'Oprit');
});

test('before / after of a rollout: N% for [] and [true, 0..N], else the custom ranges as JSON', () => {
  assert.equal(text(stateParts('rollout', { variants: [] })), '0%');
  assert.equal(text(stateParts('rollout', { variants: [{ value: true, from: 0, to: 50 }] })), '50%');
  assert.equal(text(stateParts('rollout', { variants: [{ value: true, from: 0, to: 100 }] })), '100%');
  assert.equal(
    text(stateParts('rollout', { variants: [{ value: true, from: 10, to: 60 }] })),
    'intervale personalizate `[{"value":true,"from":10,"to":60}]`',
  );
  assert.equal(
    text(stateParts('rollout', { variants: [{ value: false, from: 0, to: 50 }] })),
    'intervale personalizate `[{"value":false,"from":0,"to":50}]`',
  );
  assert.equal(
    text(stateParts('rollout', { variants: [{ value: true, from: 0, to: 20 }, { value: true, from: 20, to: 40 }] })),
    'intervale personalizate `[{"value":true,"from":0,"to":20},{"value":true,"from":20,"to":40}]`',
  );
});

test('an unknown action or shape shows the stored JSON', () => {
  assert.equal(text(stateParts('variants', { variants: [] })), '`{"variants":[]}`');
  assert.equal(text(stateParts('enable', { other: 1 })), '`{"other":1}`');
  assert.equal(text(stateParts('rollout', { variants: 'x' })), '`{"variants":"x"}`');
});

// Europe/Bucharest: UTC+2 in winter, UTC+3 in summer; 2026 switches on 29 March at 01:00 UTC
// (03:00 → 04:00 local). Worked out by hand, not from the code under test.
test('times are always in Romania (Europe/Bucharest), whatever the browser time zone', () => {
  assert.equal(timeText('2026-11-27T12:41:09.000Z'), '27 nov. 2026, 14:41:09');
  assert.equal(timeText('2026-07-01T09:00:00.000Z'), '1 iul. 2026, 12:00:00');
  assert.equal(timeText('2026-05-02T10:00:00.000Z'), '2 mai 2026, 13:00:00');
  assert.equal(timeText('2026-11-26T22:30:05.000Z'), '27 nov. 2026, 00:30:05', 'past midnight in Romania');
  assert.equal(timeText('2026-03-29T00:59:59.000Z'), '29 mar. 2026, 02:59:59', 'last second of winter time');
  assert.equal(timeText('2026-03-29T01:00:00.000Z'), '29 mar. 2026, 04:00:00', 'first second of summer time');
});

test('the config version is v<n>, without a thousands separator', () => {
  assert.equal(versionText(12), 'v12');
  assert.equal(versionText(1204), 'v1204');
});

test('subtitle: the project, and that every change is made by admin, the only role', () => {
  assert.equal(
    subtitleText('ParkingLot'),
    'Proiect: ParkingLot · fiecare schimbare din dashboard, făcută de admin (singurul rol), cea mai nouă prima. Ora României.',
  );
});

test('table caption, with and without the flag filter', () => {
  assert.equal(captionText('prod', null), 'Schimbările din prod, cea mai nouă prima');
  assert.equal(captionText('prod', 'search-v2'), 'Schimbările flag-ului search-v2 în prod, cea mai nouă prima');
});

test('footer while older changes remain: how many are shown', () => {
  assert.equal(text(footerParts({ count: 50, env: 'prod', flag: null, more: true, pages: 1 })), '50 de schimbări afișate în prod');
  assert.equal(text(footerParts({ count: 100, env: 'dev', flag: 'x', more: true, pages: 2 })), '100 de schimbări afișate în dev');
  assert.equal(text(footerParts({ count: 1, env: 'dev', flag: null, more: true, pages: 1 })), '1 schimbare afișată în dev');
});

// "Toate cele N schimbări din <env>. Mai vechi nu există." on every last page of the whole log,
// as in the approved mock (user, 2026-11-27, after checking 11 real changes on one page).
test('footer at the end: all of them, and "Mai vechi nu există." on the whole log', () => {
  assert.equal(text(footerParts({ count: 1, env: 'prod', flag: null, more: false, pages: 1 })), 'O singură schimbare în prod');
  assert.equal(text(footerParts({ count: 2, env: 'prod', flag: null, more: false, pages: 1 })), 'Toate cele 2 schimbări din prod. Mai vechi nu există.');
  assert.equal(text(footerParts({ count: 19, env: 'prod', flag: null, more: false, pages: 1 })), 'Toate cele 19 schimbări din prod. Mai vechi nu există.');
  assert.equal(text(footerParts({ count: 20, env: 'prod', flag: null, more: false, pages: 1 })), 'Toate cele 20 de schimbări din prod. Mai vechi nu există.');
  assert.equal(
    text(footerParts({ count: 52, env: 'prod', flag: null, more: false, pages: 2 })),
    'Toate cele 52 de schimbări din prod. Mai vechi nu există.',
  );
});

test('footer at the end, filtered by a flag', () => {
  assert.equal(
    text(footerParts({ count: 2, env: 'prod', flag: 'search-v2', more: false, pages: 1 })),
    'Toate cele 2 schimbări ale flag-ului `search-v2` în prod',
  );
  assert.equal(
    text(footerParts({ count: 1, env: 'dev', flag: 'search-v2', more: false, pages: 1 })),
    'O singură schimbare a flag-ului `search-v2` în dev',
  );
  assert.equal(
    text(footerParts({ count: 60, env: 'prod', flag: 'search-v2', more: false, pages: 2 })),
    'Toate cele 60 de schimbări ale flag-ului `search-v2` în prod. Mai vechi nu există.',
  );
});

test('empty titles: the environment, or the chosen flag in it', () => {
  assert.equal(text(emptyTitleParts('prod', null)), 'Nicio schimbare în prod');
  assert.equal(text(emptyTitleParts('prod', 'search-v2')), 'Nicio schimbare pentru `search-v2` în prod');
});
