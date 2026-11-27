// The copy of the audit log screen (DS-web2-audit, approved 2026-11-27), as pure functions
// over the C-007 audit entries, so they can be tested without a browser. Copy is a list of
// parts: a string is text, { code } goes into a <code> element.
import { countRo } from './flags.js';

const ACTIONS = {
  enable: { kind: 'on', icon: '●', text: 'Pornit' },
  disable: { kind: 'off', icon: '■', text: 'Oprit (kill switch)' },
  rollout: { kind: '', icon: '%', text: 'Rollout' },
};

// An unknown action (none exists today) shows as stored.
export const actionLabel = (action) => ACTIONS[action] ?? { kind: '', icon: '', text: action };

// The rollout the server reports for these variants (C-007): [] → 0, [true, 0..N] → N, else null.
function rolloutOf(variants) {
  if (variants.length === 0) return 0;
  const [v] = variants;
  return variants.length === 1 && v.value === true && v.from === 0 ? v.to : null;
}

// One side of "before → after": {enabled} → Pornit / Oprit; {variants} → N% or the custom
// ranges as JSON; anything else → the stored JSON.
export function stateParts(action, value) {
  const json = { code: JSON.stringify(value) };
  if ((action === 'enable' || action === 'disable') && typeof value?.enabled === 'boolean') {
    return [value.enabled ? 'Pornit' : 'Oprit'];
  }
  if (action === 'rollout' && Array.isArray(value?.variants)) {
    const n = rolloutOf(value.variants);
    return n === null ? ['intervale personalizate ', { code: JSON.stringify(value.variants) }] : [`${n}%`];
  }
  return [json];
}

// Always Romania's time (D-016 uses it too), whatever the browser's time zone.
const TIME = new Intl.DateTimeFormat('ro-RO', {
  timeZone: 'Europe/Bucharest',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});
export const timeText = (iso) => TIME.format(new Date(iso));

export const versionText = (version) => `v${version}`;

export const subtitleText = (projectName) =>
  `Proiect: ${projectName} · fiecare schimbare din dashboard, făcută de admin (singurul rol), cea mai nouă prima. Ora României.`;

export const captionText = (env, flag) =>
  flag === null ? `Schimbările din ${env}, cea mai nouă prima` : `Schimbările flag-ului ${flag} în ${env}, cea mai nouă prima`;

const changes = (n) => countRo(n, 'schimbare', 'schimbări');

// count = rows shown; more = an older page exists; pages = pages loaded so far.
export function footerParts({ count, env, flag, more, pages }) {
  if (more) return [`${count === 1 ? '1 schimbare afișată' : `${changes(count)} afișate`} în ${env}`];
  const end = pages > 1 ? '. Mai vechi nu există.' : '';
  if (flag === null) {
    // The whole log always ends with the sentence (the mock); one change does not.
    return [count === 1 ? `O singură schimbare în ${env}${end}` : `Toate cele ${changes(count)} din ${env}. Mai vechi nu există.`];
  }
  const head = count === 1 ? 'O singură schimbare a flag-ului ' : `Toate cele ${changes(count)} ale flag-ului `;
  return [head, { code: flag }, ` în ${env}${end}`];
}

export const emptyTitleParts = (env, flag) =>
  flag === null ? [`Nicio schimbare în ${env}`] : ['Nicio schimbare pentru ', { code: flag }, ` în ${env}`];
