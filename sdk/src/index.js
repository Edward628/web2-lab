// The SDK client (D-018): init({ sdkKey, baseUrl, config?, storage? }) →
// { identify, isEnabled, getVariant, refresh, track, flush, connect, close, status }.
// refresh() fetches the configuration (C-002) with If-None-Match (D-003); only a
// configuration that passes C-001 replaces the current one, in one swap.
// Reads never throw: an unknown flag gives false / null, no user yet gives default.
// Each read of a known flag counts an evaluation; getVariant on an experiment flag
// queues one exposure per user and flag when the value comes from a variant range.
// The last configuration from the server and its ETag are cached in storage
// (localStorage by default) under ff:config:<sdkKey>, and loaded at init (D-003).
// connect() keeps the configuration current (live.js); status() is 'stale' once 60 s
// pass with no confirmation from the server.

import { evaluateDetail } from './evaluate.js';
import { createEventQueue } from './events.js';
import { createLive } from './live.js';
import { isValidConfig } from './validate.js';

const TIMEOUT_MS = 10000; // a config request with no answer in 10 s is 'error' (D-013)
const STALE_MS = 60000;

function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // access itself throws when storage is blocked
  }
}

// → { etag, config } from storage, or null when missing, unreadable or invalid (C-001).
function loadCache(storage, cacheKey) {
  try {
    const cached = JSON.parse(storage?.getItem(cacheKey) ?? 'null');
    if (cached === null || typeof cached !== 'object') return null;
    if (typeof cached.etag !== 'string' && cached.etag !== null) return null;
    return isValidConfig(cached.config) ? cached : null;
  } catch {
    return null;
  }
}

function saveCache(storage, cacheKey, etag, config) {
  try {
    storage?.setItem(cacheKey, JSON.stringify({ etag, config }));
  } catch {
    // blocked or full: the configuration lasts only as long as the page
  }
}

export function init({ sdkKey, baseUrl, config, storage = defaultStorage() }) {
  if (config !== undefined && !isValidConfig(config)) {
    throw new TypeError('init: config does not match C-001');
  }
  const cacheKey = `ff:config:${sdkKey}`;
  const cached = config === undefined ? loadCache(storage, cacheKey) : null;
  let current = config ?? cached?.config ?? null;
  let etag = cached?.etag ?? null;
  let user = null;
  let confirmedAt = Date.now();
  const confirm = () => {
    confirmedAt = Date.now();
  };
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
    if (res.status === 304) {
      confirm();
      return 'not-modified';
    }
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
    confirm();
    saveCache(storage, cacheKey, etag, next);
    return 'updated';
  }

  const live =
    typeof baseUrl === 'string'
      ? createLive({
          streamUrl: `${baseUrl}/sdk/stream?key=${encodeURIComponent(sdkKey)}`,
          refresh,
          currentVersion: () => current?.version ?? null,
          confirm,
        })
      : null;

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
    connect: () => live?.connect(),
    close: () => live?.close(),
    // → 'ok' | 'stale'
    status: () => (Date.now() - confirmedAt >= STALE_MS ? 'stale' : 'ok'),
  };
}
