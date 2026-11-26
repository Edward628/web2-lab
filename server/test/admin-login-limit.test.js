import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword } from '../src/admin.js';
import { testPool, reset, seed, listen } from './helpers.js';

// The login limit (Q-038, C-007): one password check (scrypt) at a time, and at most
// 10 failed logins per minute in total; then 429, for every login, until that minute
// (counted from its first failure) ends. Each test starts its own app, so the count
// starts at zero. The password is a test value, not a secret.
const PASSWORD = 'limit-test password';
const pool = testPool();
let hash;
before(async () => {
  hash = await hashPassword(PASSWORD);
  await reset(pool);
  await seed(pool);
});
after(() => pool.end());

async function withApp(t) {
  const app = await listen(pool, { adminPasswordHash: hash });
  t.after(() => app.close());
  return app;
}

const login = (app, password) =>
  fetch(`${app.baseUrl}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

test('10 failed logins get 401; the 11th, and even the right password, get 429 with no cookie and no body', async (t) => {
  const app = await withApp(t);
  for (let i = 0; i < 10; i++) assert.equal((await login(app, `wrong ${i}`)).status, 401, `try ${i + 1}`);
  const wrong = await login(app, 'wrong again');
  assert.equal(wrong.status, 429);
  assert.equal(await wrong.text(), '');
  const right = await login(app, PASSWORD);
  assert.equal(right.status, 429);
  assert.equal(right.headers.get('set-cookie'), null);
});

test('after the minute that began with the first failure, logins are checked again', async (t) => {
  const app = await withApp(t);
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  for (let i = 0; i < 10; i++) assert.equal((await login(app, 'wrong')).status, 401);
  t.mock.timers.tick(59_000);
  assert.equal((await login(app, PASSWORD)).status, 429, 'still inside the minute');
  t.mock.timers.tick(1_000);
  assert.equal((await login(app, PASSWORD)).status, 204, 'a new minute');
  assert.equal((await login(app, 'wrong')).status, 401, 'the new minute counts from zero');
});

test('failures from an earlier minute do not count', async (t) => {
  const app = await withApp(t);
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  for (let i = 0; i < 9; i++) assert.equal((await login(app, 'wrong')).status, 401);
  t.mock.timers.tick(60_000);
  for (let i = 0; i < 10; i++) assert.equal((await login(app, 'wrong')).status, 401, `try ${i + 1}`);
  assert.equal((await login(app, 'wrong')).status, 429);
});

test('a successful login does not count as a failure and does not clear the count', async (t) => {
  const app = await withApp(t);
  for (let i = 0; i < 9; i++) assert.equal((await login(app, 'wrong')).status, 401);
  for (let i = 0; i < 3; i++) assert.equal((await login(app, PASSWORD)).status, 204);
  assert.equal((await login(app, 'wrong')).status, 401, 'the 10th failure');
  assert.equal((await login(app, PASSWORD)).status, 429);
});

test('20 logins at the same time: checks run one at a time, so exactly 10 fail with 401 and 10 get 429', async (t) => {
  const app = await withApp(t);
  const statuses = (await Promise.all(Array.from({ length: 20 }, (_, i) => login(app, `wrong ${i}`)))).map((r) => r.status);
  assert.equal(statuses.filter((s) => s === 401).length, 10, statuses.join(' '));
  assert.equal(statuses.filter((s) => s === 429).length, 10, statuses.join(' '));
});

test('bad requests (400, 415) are not failed logins and are not limited', async (t) => {
  const app = await withApp(t);
  for (let i = 0; i < 12; i++) {
    const res = await fetch(`${app.baseUrl}/admin/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 400);
  }
  assert.equal((await login(app, PASSWORD)).status, 204);
});

test('each app has its own count (a restart starts from zero)', async (t) => {
  const first = await withApp(t);
  for (let i = 0; i < 10; i++) await login(first, 'wrong');
  assert.equal((await login(first, PASSWORD)).status, 429);
  const second = await withApp(t);
  assert.equal((await login(second, PASSWORD)).status, 204);
});
