import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/api.js';

// The dashboard side of C-007. fetch is passed in: each test answers with a status
// (or throws, like a network error) and keeps the requests it saw.
function fakeFetch(answer) {
  const calls = [];
  const fetch = async (url, options = {}) => {
    calls.push({ url, ...options });
    return answer(url, options);
  };
  return { fetch, calls };
}
const status = (code, body) => () =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status: code,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
  });
const offline = () => {
  throw new TypeError('fetch failed');
};

function api(answer) {
  const { fetch, calls } = fakeFetch(answer);
  const unauthorized = [];
  return { api: createApi({ fetch, onUnauthorized: () => unauthorized.push(true) }), calls, unauthorized };
}

test('login posts the password as JSON to /admin/login, same origin, with a timeout signal', async () => {
  const t = api(status(204));
  assert.equal(await t.api.login('a password'), 'ok');
  assert.equal(t.calls.length, 1);
  const [call] = t.calls;
  assert.equal(call.url, '/admin/login');
  assert.equal(call.method, 'POST');
  assert.equal(call.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(call.body), { password: 'a password' });
  assert.equal(call.credentials, 'same-origin');
  assert.ok(call.signal instanceof AbortSignal);
});

test('login maps each answer to a state of DS-web2-login', async () => {
  for (const [code, outcome] of [
    [401, 'wrong'],
    [429, 'limited'],
    [503, 'unconfigured'],
    [500, 'error'],
    [400, 'error'],
    [415, 'error'],
  ]) {
    const t = api(status(code));
    assert.equal(await t.api.login('x'), outcome, String(code));
    assert.deepEqual(t.unauthorized, [], 'a wrong password is not an expired session');
  }
  assert.equal(await api(offline).api.login('x'), 'error');
});

test('listFlags gets /admin/flags?env=… and returns the data', async () => {
  const data = { project: { id: 1, name: 'ParkingLot' }, environment: 'dev', version: 3, flags: [] };
  const t = api(status(200, data));
  assert.deepEqual(await t.api.listFlags('dev'), { ok: true, data });
  assert.equal(t.calls[0].url, '/admin/flags?env=dev');
  assert.equal(t.calls[0].method, 'GET');
  assert.equal(t.calls[0].credentials, 'same-origin');
  assert.ok(t.calls[0].signal instanceof AbortSignal);
});

test('listFlags: 401 calls onUnauthorized once; other failures and network errors are errors', async () => {
  const t = api(status(401));
  assert.deepEqual(await t.api.listFlags('prod'), { ok: false, error: 'unauthorized' });
  assert.equal(t.unauthorized.length, 1);
  for (const answer of [status(500), status(404), offline]) {
    const u = api(answer);
    assert.deepEqual(await u.api.listFlags('prod'), { ok: false, error: 'error' });
    assert.equal(u.unauthorized.length, 0);
  }
});

test('setEnabled patches the encoded key with {enabled} as JSON and returns {flag, version}', async () => {
  const data = { flag: { key: 'a b/c', enabled: false }, version: 8 };
  const t = api(status(200, data));
  assert.deepEqual(await t.api.setEnabled('a b/c', 'prod', false), { ok: true, data });
  const [call] = t.calls;
  assert.equal(call.url, '/admin/flags/a%20b%2Fc?env=prod');
  assert.equal(call.method, 'PATCH');
  assert.equal(call.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(call.body), { enabled: false });
  assert.ok(call.signal instanceof AbortSignal);
});

test('setEnabled: 401 calls onUnauthorized; 404, 500 and network errors are errors', async () => {
  const t = api(status(401));
  assert.deepEqual(await t.api.setEnabled('k', 'dev', true), { ok: false, error: 'unauthorized' });
  assert.equal(t.unauthorized.length, 1);
  for (const answer of [status(404), status(500), offline]) {
    assert.deepEqual(await api(answer).api.setEnabled('k', 'dev', true), { ok: false, error: 'error' });
  }
});

test('logout posts /admin/logout and reports whether the server ended the session', async () => {
  const t = api(status(204));
  assert.equal(await t.api.logout(), true);
  assert.equal(t.calls[0].url, '/admin/logout');
  assert.equal(t.calls[0].method, 'POST');
  assert.equal(await api(status(401)).api.logout(), false);
  assert.equal(await api(offline).api.logout(), false);
});

test('a request with no answer in 10 s is an error (the timeout aborts it)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { fetch } = fakeFetch(
    (url, { signal }) =>
      new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason))),
  );
  // AbortSignal.timeout does not follow mocked timers, so the api takes its own timer.
  const pending = createApi({ fetch, onUnauthorized() {} }).listFlags('dev');
  t.mock.timers.tick(10_000);
  assert.deepEqual(await pending, { ok: false, error: 'error' });
});
