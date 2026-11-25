// The SDK client (D-009): init({ sdkKey, baseUrl, config? }) →
// { identify, isEnabled, getVariant, refresh }.
// refresh() fetches the configuration (C-002) with If-None-Match (D-003); only a
// configuration that passes C-001 replaces the current one, in one swap.
// Reads never throw: an unknown flag gives false / null, no user yet gives default.

import { evaluate } from './evaluate.js';
import { isValidConfig } from './validate.js';

export function init({ sdkKey, baseUrl, config }) {
  if (config !== undefined && !isValidConfig(config)) {
    throw new TypeError('init: config does not match C-001');
  }
  let current = config ?? null;
  let etag = null;
  let user = null;

  function value(flagKey) {
    const flags = current?.flags;
    if (typeof flagKey !== 'string' || !flags || !Object.hasOwn(flags, flagKey)) return null;
    const flag = flags[flagKey];
    if (user === null) return flag.default;
    return evaluate(flagKey, flag, user);
  }

  // → 'updated' | 'not-modified' | 'rejected' | 'error'; never rejects.
  async function refresh() {
    if (typeof baseUrl !== 'string') return 'error';
    let res;
    try {
      const headers = etag === null ? {} : { 'If-None-Match': etag };
      res = await fetch(`${baseUrl}/sdk/config?key=${encodeURIComponent(sdkKey)}`, { headers });
    } catch {
      return 'error';
    }
    if (res.status === 304) return 'not-modified';
    if (res.status !== 200) return 'error';
    let next;
    try {
      next = await res.json();
    } catch {
      return 'rejected';
    }
    if (!isValidConfig(next)) return 'rejected';
    current = next;
    etag = res.headers.get('ETag');
    return 'updated';
  }

  return {
    sdkKey,
    identify(userId, attributes = {}) {
      if (typeof userId !== 'string') {
        throw new TypeError('identify: userId must be a string');
      }
      user = { userId, attributes };
    },
    isEnabled: (flagKey) => value(flagKey) === true,
    getVariant: (flagKey) => value(flagKey),
    refresh,
  };
}
