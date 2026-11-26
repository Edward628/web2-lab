// The dashboard's client for the admin API (C-007), on the same origin; the session
// is the httpOnly cookie, so the page never sees it (D-019). A 401 outside login calls
// onUnauthorized (the page goes to the login screen). No answer in 10 s is an error.
const TIMEOUT_MS = 10_000;

export function createApi({ fetch = globalThis.fetch.bind(globalThis), onUnauthorized }) {
  // → the Response, or null on a network error or timeout.
  async function request(method, url, body) {
    const controller = new AbortController();
    // Its own timer (not AbortSignal.timeout), so tests can drive it with mocked timers.
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await fetch(url, {
        method,
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'same-origin',
        signal: controller.signal,
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  // → { ok: true, data } on 200, else { ok: false, error: 'unauthorized' | 'error' }.
  async function data(method, url, body) {
    const res = await request(method, url, body);
    if (res?.status === 401) {
      onUnauthorized();
      return { ok: false, error: 'unauthorized' };
    }
    if (res?.status !== 200) return { ok: false, error: 'error' };
    try {
      return { ok: true, data: await res.json() };
    } catch {
      return { ok: false, error: 'error' };
    }
  }

  const LOGIN_OUTCOMES = { 204: 'ok', 401: 'wrong', 429: 'limited', 503: 'unconfigured' };

  return {
    // → 'ok' | 'wrong' | 'limited' | 'unconfigured' | 'error' (the DS-web2-login states)
    async login(password) {
      const res = await request('POST', '/admin/login', { password });
      return LOGIN_OUTCOMES[res?.status] ?? 'error';
    },
    async logout() {
      const res = await request('POST', '/admin/logout');
      return res?.status === 204;
    },
    listFlags: (env) => data('GET', `/admin/flags?env=${encodeURIComponent(env)}`),
    setEnabled: (key, env, enabled) =>
      data('PATCH', `/admin/flags/${encodeURIComponent(key)}?env=${encodeURIComponent(env)}`, { enabled }),
  };
}
