// Local evaluation of one flag (D-004) on the configuration shape C-001.
// Pure, so the server can run the same code.

import { bucket } from './bucket.js';

function matches(rule, attributes) {
  if (!Object.hasOwn(attributes, rule.attribute)) return false;
  const actual = attributes[rule.attribute];
  if (rule.operator === 'equals') return actual === rule.value;
  if (rule.operator === 'in') return Array.isArray(rule.values) && rule.values.includes(actual);
  return false; // unknown operator: no match (D-009)
}

// Off → default; on → first matching rule, then the variant whose [from, to)
// holds the user's bucket; a bucket no range covers → default.
// fromVariant: the value came from a variant range (D-011: only then an exposure).
export function evaluateDetail(flagKey, flag, user) {
  if (!flag.enabled) return { value: flag.default, fromVariant: false };
  const attributes = user.attributes ?? {};
  for (const rule of flag.rules ?? []) {
    if (matches(rule, attributes)) return { value: rule.serve, fromVariant: false };
  }
  const b = bucket(flagKey, user.userId);
  for (const v of flag.variants ?? []) {
    if (v.from <= b && b < v.to) return { value: v.value, fromVariant: true };
  }
  return { value: flag.default, fromVariant: false };
}

export function evaluate(flagKey, flag, user) {
  return evaluateDetail(flagKey, flag, user).value;
}
