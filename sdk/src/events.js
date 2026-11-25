// The SDK's event queue (D-011), sent to POST /sdk/events (C-003).
// Events stay queued until their response arrives: 2xx or 4xx removes them by id,
// a 5xx or a network error keeps them (same ids) for the next send. One request is
// in flight at a time (Q-034); pagehide alone sends the whole queue at once.
// Evaluation counts go out as one `evaluations` event, appended when none is waiting.

const BATCH = 20;
const DELAY_MS = 5000;

// 128 random bits as 32 hex digits (randomUUID needs a secure context, D-011).
function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Without a baseUrl there is nowhere to send: nothing is queued.
export function createEventQueue({ sdkKey, baseUrl }) {
  const enabled = typeof baseUrl === 'string';
  const url = enabled ? `${baseUrl}/sdk/events?key=${encodeURIComponent(sdkKey)}` : null;
  let queue = [];
  let counts = new Map();
  let timer = null;
  let inflight = null;

  function startTimer() {
    if (timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      sendNext();
    }, DELAY_MS);
    timer.unref?.(); // a pending send must not keep Node alive
  }

  function clearTimer() {
    clearTimeout(timer);
    timer = null;
  }

  function takeCounts() {
    if (counts.size === 0 || queue.some((e) => e.type === 'evaluations')) return;
    queue.push({ id: newId(), type: 'evaluations', counts: Object.fromEntries(counts) });
    counts = new Map();
  }

  // → 'sent' | 'dropped' | 'error'; never rejects.
  async function post(events) {
    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events }),
        keepalive: true,
      });
    } catch {
      return 'error';
    }
    const result = res.status >= 200 && res.status < 300 ? 'sent' : res.status >= 400 && res.status < 500 ? 'dropped' : 'error';
    if (result !== 'error') {
      const done = new Set(events.map((e) => e.id));
      queue = queue.filter((e) => !done.has(e.id));
    }
    return result;
  }

  // Starts the next request unless one is in flight; → its promise, or null if nothing to send.
  function sendNext() {
    if (inflight) return inflight;
    clearTimer();
    takeCounts();
    if (queue.length === 0) return null;
    inflight = post(queue.slice(0, BATCH)).then((result) => {
      inflight = null;
      if (result !== 'error' && queue.length >= BATCH) sendNext();
      else if (queue.length > 0 || counts.size > 0) startTimer();
      return result;
    });
    return inflight;
  }

  function push(event) {
    if (!enabled) return;
    queue.push({ id: newId(), ...event });
    if (queue.length >= BATCH) sendNext();
    else startTimer();
  }

  function count(flagKey) {
    if (!enabled) return;
    counts.set(flagKey, (counts.get(flagKey) ?? 0) + 1);
    startTimer();
  }

  // → 'sent' | 'empty' | 'error' | 'dropped'; never rejects.
  async function flush() {
    const results = new Set();
    for (let pending = sendNext(); pending; pending = sendNext()) {
      const result = await pending;
      results.add(result);
      if (result === 'error') break;
    }
    for (const r of ['error', 'dropped', 'sent']) if (results.has(r)) return r;
    return 'empty';
  }

  // The page is going away: send everything now, in-flight events included.
  function sendAll() {
    clearTimer();
    takeCounts();
    for (let i = 0; i < queue.length; i += BATCH) post(queue.slice(i, i + BATCH));
  }

  if (enabled) globalThis.addEventListener?.('pagehide', sendAll);

  return { push, count, flush };
}
