import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword } from '../src/admin.js';
import { testPool, reset, seed, listen } from './helpers.js';

// Admin login and session (D-008, D-019, C-007) against a real PostgreSQL.
// The password is a test value, not a secret.
const PASSWORD = 'correct horse battery staple';
const pool = testPool();
let hash;
let app;
before(async () => {
  hash = await hashPassword(PASSWORD);
  await reset(pool);
  app = await listen(pool, { adminPasswordHash: hash });
});
beforeEach(async () => {
  await reset(pool);
  await seed(pool);
});
after(async () => {
  await app?.close();
  await pool.end();
});

const login = (target, body, contentType = 'application/json') =>
  fetch(`${target.baseUrl}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

// → the "ff_admin=<token>" pair from a successful login.
async function session(target = app) {
  const res = await login(target, { password: PASSWORD });
  assert.equal(res.status, 204);
  return res.headers.get('set-cookie').split(';')[0];
}

const flags = (cookie) =>
  fetch(`${app.baseUrl}/admin/flags?env=dev`, { headers: cookie ? { Cookie: cookie } : {} });

test('hashPassword gives scrypt:<32 hex salt>:<128 hex hash>, a new salt each time, no $', async () => {
  assert.match(hash, /^scrypt:[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.notEqual(await hashPassword(PASSWORD), hash);
});

test('the right password gets 204 and an HttpOnly, Secure, SameSite=Strict session cookie for 8 h', async () => {
  const res = await login(app, { password: PASSWORD });
  assert.equal(res.status, 204);
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, /^ff_admin=[0-9a-f]{64};/);
  for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=28800']) {
    assert.ok(cookie.split('; ').includes(attribute), `${attribute} in ${cookie}`);
  }
  assert.equal((await flags(cookie.split(';')[0])).status, 200);
});

test('two logins get two different tokens', async () => {
  assert.notEqual(await session(), await session());
});

test('a wrong password gets 401 and no cookie', async () => {
  for (const password of ['wrong', '', PASSWORD.toUpperCase(), `${PASSWORD} `]) {
    const res = await login(app, { password });
    assert.equal(res.status, 401, JSON.stringify(password));
    assert.equal(res.headers.get('set-cookie'), null);
  }
});

test('a body that is not JSON, or has no string password, gets 400', async () => {
  for (const body of ['{not json', {}, { password: 42 }, { password: null }, [PASSWORD], 'null']) {
    const res = await login(app, body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(res.headers.get('set-cookie'), null);
  }
});

test('a login that is not application/json gets 415 (a cross-site form cannot post it)', async () => {
  for (const type of ['application/x-www-form-urlencoded', 'text/plain', 'multipart/form-data; boundary=x']) {
    const res = await login(app, `password=${encodeURIComponent(PASSWORD)}`, type);
    assert.equal(res.status, 415, type);
    assert.equal(res.headers.get('set-cookie'), null);
  }
});

test('without ADMIN_PASSWORD_HASH, login gets 503 and every admin route 401', async () => {
  const bare = await listen(pool);
  try {
    assert.equal((await login(bare, { password: PASSWORD })).status, 503);
    assert.equal((await fetch(`${bare.baseUrl}/admin/flags?env=dev`)).status, 401);
  } finally {
    await bare.close();
  }
});

test('a malformed hash: login gets 503, and the log names the variable but never shows its value', async (t) => {
  const logged = [];
  for (const method of ['log', 'info', 'warn', 'error']) {
    t.mock.method(console, method, (...args) => logged.push(args.map(String).join(' ')));
  }
  const malformed = 'bcrypt$2b$10$notourformat';
  const bad = await listen(pool, { adminPasswordHash: malformed });
  try {
    assert.equal((await login(bad, { password: PASSWORD })).status, 503);
  } finally {
    await bad.close();
  }
  assert.ok(logged.some((line) => line.includes('ADMIN_PASSWORD_HASH')), logged.join('\n'));
  assert.ok(!logged.some((line) => line.includes(malformed)), logged.join('\n'));
});

test('neither the password nor the hash is ever written to the log', async (t) => {
  const logged = [];
  for (const method of ['log', 'info', 'warn', 'error', 'debug']) {
    t.mock.method(console, method, (...args) => logged.push(args.map(String).join(' ')));
  }
  await login(app, { password: PASSWORD });
  await login(app, { password: `${PASSWORD}x` });
  await login(app, '{"password":');
  const all = logged.join('\n');
  assert.ok(!all.includes(PASSWORD), all);
  assert.ok(!all.includes(hash.split(':')[2]), all);
});

test('every admin route except login gets 401 without a cookie or with an unknown one', async () => {
  const unknown = `ff_admin=${'0'.repeat(64)}`;
  for (const cookie of [undefined, unknown, 'ff_admin=', 'other=1']) {
    const headers = cookie ? { Cookie: cookie } : {};
    assert.equal((await fetch(`${app.baseUrl}/admin/flags?env=dev`, { headers })).status, 401, cookie);
    const patch = await fetch(`${app.baseUrl}/admin/flags/new-checkout?env=dev`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    assert.equal(patch.status, 401, cookie);
    assert.equal((await fetch(`${app.baseUrl}/admin/logout`, { method: 'POST', headers })).status, 401, cookie);
  }
  const { rows } = await pool.query('SELECT enabled FROM flag_environments WHERE flag_id = 1 AND environment_id = 1');
  assert.equal(rows[0].enabled, true);
});

test('the session cookie is found among other cookies', async () => {
  const cookie = await session();
  assert.equal((await flags(`a=1; ${cookie}; b=2`)).status, 200);
});

test('a session works until 8 h after login and gets 401 after that', async (t) => {
  const cookie = await session();
  const loggedInAt = Date.now();
  t.mock.timers.enable({ apis: ['Date'], now: loggedInAt + 8 * 3600_000 - 5_000 });
  assert.equal((await flags(cookie)).status, 200);
  t.mock.timers.tick(10_000);
  assert.equal((await flags(cookie)).status, 401);
});

test('logout gets 204, clears the cookie and ends the session; other sessions keep working', async () => {
  const cookie = await session();
  const other = await session();
  const res = await fetch(`${app.baseUrl}/admin/logout`, { method: 'POST', headers: { Cookie: cookie } });
  assert.equal(res.status, 204);
  const cleared = res.headers.get('set-cookie');
  assert.match(cleared, /^ff_admin=;/);
  assert.ok(cleared.split('; ').includes('Max-Age=0'), cleared);
  assert.equal((await flags(cookie)).status, 401);
  assert.equal((await flags(other)).status, 200);
});

test('admin responses have no CORS header', async () => {
  const res = await login(app, { password: PASSWORD });
  assert.equal(res.headers.get('access-control-allow-origin'), null);
  const preflight = await fetch(`${app.baseUrl}/admin/flags/new-checkout?env=dev`, { method: 'OPTIONS' });
  assert.equal(preflight.headers.get('access-control-allow-origin'), null);
});

test('any other /admin path or method gets 401 without a session and 404 with one, both with no body (C-007)', async () => {
  const requests = [
    ['GET', '/admin'],
    ['GET', '/admin/x'],
    ['GET', '/admin/flags/new-checkout?env=dev'],
    ['DELETE', '/admin/flags/new-checkout?env=dev'],
    ['POST', '/admin/flags?env=dev'],
    ['PUT', '/admin/flags/new-checkout?env=dev'],
    ['OPTIONS', '/admin/flags/new-checkout?env=dev'],
    ['OPTIONS', '/admin/flags?env=dev'],
  ];
  const cookie = await session();
  for (const [method, path] of requests) {
    for (const [headers, status] of [[{}, 401], [{ Cookie: cookie }, 404]]) {
      const res = await fetch(`${app.baseUrl}${path}`, { method, headers });
      assert.equal(res.status, status, `${method} ${path} ${status}`);
      assert.equal(await res.text(), '', `${method} ${path}`);
      assert.equal(res.headers.get('allow'), null, `${method} ${path}`);
    }
  }
});
