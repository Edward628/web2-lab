// Live updates (D-018, D-003): an EventSource on GET /sdk/stream (C-006). A version
// newer than the current configuration → refresh(). After an error the stream is
// closed and reopened 3 s later; 3 errors in a row with no open in between → polling
// only, refresh() at once and then every 30 s, until close(). Each open and each
// version message is a confirmation (status(), in index.js).

const RECONNECT_MS = 3000;
const POLL_MS = 30000;
const MAX_FAILURES = 3;

export function createLive({ streamUrl, refresh, currentVersion, confirm }) {
  let source = null;
  let timer = null;
  let failures = 0;
  let running = false;

  function later(fn, ms) {
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, ms);
    timer.unref?.(); // a pending reconnect or poll must not keep Node alive
  }

  function poll() {
    refresh();
    later(poll, POLL_MS);
  }

  function open() {
    const es = new EventSource(streamUrl);
    source = es;
    es.addEventListener('open', () => {
      if (source !== es) return;
      failures = 0;
      confirm();
    });
    es.addEventListener('version', (event) => {
      if (source !== es || !/^\d+$/.test(event.data)) return;
      const version = Number(event.data);
      confirm();
      const current = currentVersion();
      if (current === null || version > current) refresh();
    });
    es.addEventListener('error', () => {
      if (source !== es) return;
      es.close();
      source = null;
      failures += 1;
      if (failures >= MAX_FAILURES) poll();
      else later(open, RECONNECT_MS);
    });
  }

  function connect() {
    if (running) return;
    running = true;
    failures = 0;
    if (typeof globalThis.EventSource === 'function') open();
    else poll();
  }

  function close() {
    running = false;
    source?.close();
    source = null;
    clearTimeout(timer);
    timer = null;
  }

  return { connect, close };
}
