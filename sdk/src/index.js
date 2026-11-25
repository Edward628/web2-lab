// The SDK client (D-011): init({ sdkKey, baseUrl, config? }) →
// { identify, isEnabled, getVariant, refresh, track, flush }.
// refresh() fetches the configuration (C-002) with If-None-Match (D-003); only a
// configuration that passes C-001 replaces the current one, in one swap.
// Reads never throw: an unknown flag gives false / null, no user yet gives default.
// Each read of a known flag counts an evaluation; getVariant on an experiment flag
// queues one exposure per user and flag when the value comes from a variant range.

import { evaluateDetail } from './evaluate.js';
import { createEventQueue } from './events.js';
import { isValidConfig } from './validate.js';

const TIMEOUT_MS = 10000; // a config request with no answer in 10 s is 'error' (D-013)

export function init({ sdkKey, baseUrl, config }) {
  if (config !== undefined && !isValidConfig(config)) {
    throw new TypeError('init: config does not match C-001');
  }
  let current = config ?? null;
  let etag = null;
  let user = null;
  const events = createEventQueue({ sdkKey, baseUrl });
  const exposed = new Set();

  function value(flagKey, exposes) {
    const flags = current?.flags;
    if (typeof flagKey !== 'string' || !flags || !Object.hasOwn(flags, flagKey)) return null;
    const flag = flags[flagKey];
    events.count(flagKey);
    if (user === null) return flag.default;
    const { value, fromVariant } = evaluateDetail(flagKey, flag, user);
    if (exposes && fromVariant && flag.experiment === true) {
      const key = JSON.stringify([user.userId, flagKey]);
      if (!exposed.has(key)) {
        exposed.add(key);
        events.push({ type: 'exposure', userId: user.userId, flagKey, variant: value });
      }
    }
    return value;
  }

  // → 'updated' | 'not-modified' | 'rejected' | 'error'; never rejects.
  async function refresh() {
    if (typeof baseUrl !== 'string') return 'error';
    let res;
    const signal = AbortSignal.timeout(TIMEOUT_MS);
    try {
      const headers = etag === null ? {} : { 'If-None-Match': etag };
      res = await fetch(`${baseUrl}/sdk/config?key=${encodeURIComponent(sdkKey)}`, { headers, signal });
    } catch {
      return 'error';
    }
    if (res.status === 304) return 'not-modified';
    if (res.status !== 200) return 'error';
    let next;
    try {
      next = await res.json();
    } catch {
      return signal.aborted ? 'error' : 'rejected'; // the body stalled past the timeout
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
    isEnabled: (flagKey) => value(flagKey, false) === true,
    getVariant: (flagKey) => value(flagKey, true),
    refresh,
    // Queues a conversion; ignored before identify (D-011).
    track(metric) {
      if (typeof metric !== 'string') {
        throw new TypeError('track: metric must be a string');
      }
      if (user === null) return;
      events.push({ type: 'conversion', userId: user.userId, metric });
    },
    flush: events.flush,
  };
}
