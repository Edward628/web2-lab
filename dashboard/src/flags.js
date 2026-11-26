// The copy and summaries of the flags screen (DS-web2-flags, approved 2026-11-26), as
// pure functions so they can be tested without a browser. Copy is a list of parts:
// a string is text, { code } goes into a <code> element (flag keys and values).

// "1 regulă", "2 reguli", "20 de reguli": Romanian puts "de" before numbers from 20
// on, unless the last two digits are 01–19.
export function needsDe(n) {
  const lastTwo = n % 100;
  return n >= 20 && (lastTwo === 0 || lastTwo >= 20);
}

export function countRo(n, one, many) {
  if (n === 1) return `${n} ${one}`;
  return `${n} ${needsDe(n) ? 'de ' : ''}${many}`;
}

export function typeLabel(flag) {
  if (flag.type !== 'multivariate') return 'boolean';
  return `multivariat · ${countRo(flag.variants.length, 'variantă', 'variante')}`;
}

// "1 regulă · rollout 10%", "alocare 50 / 50", or "fără reguli".
export function targetingSummary(flag) {
  const parts = [];
  if (flag.ruleCount > 0) parts.push(countRo(flag.ruleCount, 'regulă', 'reguli'));
  if (flag.type === 'boolean' && flag.rollout !== null) {
    if (flag.variants.length > 0) parts.push(`rollout ${flag.rollout}%`);
  } else if (flag.variants.length > 0) {
    parts.push(`alocare ${flag.variants.map((v) => v.to - v.from).join(' / ')}`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'fără reguli';
}

// D-004: the switch asks for confirmation in prod, in both directions.
export const needsConfirm = (env) => env === 'prod';

export function confirmCopy(flag, enabled, env) {
  if (!enabled) {
    return {
      title: ['Oprești ', { code: flag.key }, ` în ${env}?`],
      body: [
        'Toți utilizatorii primesc imediat valoarea implicită (',
        { code: JSON.stringify(flag.default) },
        '). Schimbarea apare în jurnalul de audit și poate fi anulată.',
      ],
      action: 'Oprește flag-ul',
      danger: true,
    };
  }
  return {
    title: ['Pornești ', { code: flag.key }, ` în ${env}?`],
    body: ['Utilizatorii primesc imediat valoarea dată de reguli și de rollout. Schimbarea apare în jurnalul de audit și poate fi anulată.'],
    action: 'Pornește flag-ul',
    danger: false,
  };
}

// `flag` is the flag after the change, as the server returned it.
export function successCopy(flag, env, version) {
  const state = flag.enabled ? 'pornit' : 'oprit';
  return {
    title: `Flag ${state}.`,
    body: [
      { code: flag.key },
      ` e ${state} în ${env}, în configurația v${version}. Aplicațiile conectate o primesc în cel mult 15 s; celelalte, la următoarea încărcare.`,
    ],
  };
}

// `enabled` is the value that could not be set; the flag kept the other one.
export function writeErrorCopy(key, enabled, env) {
  return {
    title: [`Nu am putut ${enabled ? 'porni' : 'opri'} `, { code: key }, '.'],
    body: `Serverul nu a răspuns, deci flag-ul a rămas ${enabled ? 'oprit' : 'pornit'} în ${env}. Încearcă din nou.`,
  };
}

export const undoOf = (change) => ({ key: change.key, env: change.env, enabled: !change.enabled });

export const footerText = (count, env, version) => `${countRo(count, 'flag', 'flag-uri')} în ${env} · configurația v${version}`;

export const emptyTitle = (env) => `Niciun flag în ${env}`;
