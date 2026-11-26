import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { testPool, reset, seed, listen } from './helpers.js';

// GET /sdk/stream (C-006) against a real PostgreSQL (TEST_DATABASE_URL): "version N" on
// connect and every 15 s while a stream of that environment is open. setInterval is
// mocked where the 15 s matter; the app is started after, so its timers are the mocked ones.
const pool = testPool();
before(async () => {
  await reset(pool);
});
beforeEach(async () => {
  await reset(pool);
  await seed(pool);
});
after(async () => {
  await pool.end();
});

async function start(t) {
  const app = await listen(pool);
  t.after(app.close);
  return app;
}

// Opens a stream; next() resolves with the next whole message ("event: …\ndata: …").
async function openStream(baseUrl, key) {
  const controller = new AbortController();
  const res = await fetch(`${baseUrl}/sdk/stream?key=${encodeURIComponent(key)}`, { signal: controller.signal });
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = '';
  async function next() {
    while (!buffer.includes('\n\n')) {
      const { value, done } = await reader.read();
      if (done) throw new Error('stream ended');
      buffer += value;
    }
    const end = buffer.indexOf('\n\n');
    const message = buffer.slice(0, end);
    buffer = buffer.slice(end + 2);
    return message;
  }
  const close = () => controller.abort();
  return { res, next, close };
}

const version = (n) => `event: version\ndata: ${n}`;
const settle = () => delay(50); // real time, for the server and PostgreSQL to answer

test('no key → 400; an unknown key → 404, without a stream', async (t) => {
  const app = await start(t);
  assert.equal((await fetch(`${app.baseUrl}/sdk/stream`)).status, 400);
  assert.equal((await fetch(`${app.baseUrl}/sdk/stream?key=`)).status, 400);
  const unknown = await fetch(`${app.baseUrl}/sdk/stream?key=no-such-key`);
  assert.equal(unknown.status, 404);
  assert.equal(unknown.headers.get('content-type'), null);
  assert.equal((await fetch(`${app.baseUrl}/sdk/stream?key=a%00b`)).status, 404);
});

test('a known key → 200 text/event-stream, no-cache, CORS, and the current version at once', async (t) => {
  const app = await start(t);
  const s = await openStream(app.baseUrl, 'key-a-dev');
  t.after(s.close);
  assert.equal(s.res.status, 200);
  assert.match(s.res.headers.get('content-type'), /^text\/event-stream/);
  assert.equal(s.res.headers.get('cache-control'), 'no-cache');
  assert.equal(s.res.headers.get('access-control-allow-origin'), '*');
  assert.equal(await s.next(), version(7));
});

test('every 15 s the stream sends the environment version; only its own environment', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const app = await start(t);
  const a = await openStream(app.baseUrl, 'key-a-dev');
  const b = await openStream(app.baseUrl, 'key-b-dev');
  t.after(a.close);
  t.after(b.close);
  assert.equal(await a.next(), version(7));
  assert.equal(await b.next(), version(1));
  await pool.query('UPDATE environments SET config_version = 8 WHERE id = 1');
  let early = false;
  const pending = a.next().then((m) => ((early = true), m));
  t.mock.timers.tick(14999);
  await settle();
  assert.equal(early, false);
  t.mock.timers.tick(1);
  assert.equal(await pending, version(8));
  assert.equal(await b.next(), version(1));
  t.mock.timers.tick(15000);
  assert.equal(await a.next(), version(8));
});

test('two streams of one environment both get the version', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const app = await start(t);
  const s1 = await openStream(app.baseUrl, 'key-a-dev');
  const s2 = await openStream(app.baseUrl, 'key-a-dev');
  t.after(s1.close);
  t.after(s2.close);
  await s1.next();
  await s2.next();
  t.mock.timers.tick(15000);
  assert.equal(await s1.next(), version(7));
  assert.equal(await s2.next(), version(7));
});

test('when the last stream of an environment closes, its timer stops', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const app = await start(t);
  const s1 = await openStream(app.baseUrl, 'key-a-dev');
  const s2 = await openStream(app.baseUrl, 'key-a-dev');
  await s1.next();
  await s2.next();
  const queries = t.mock.method(pool, 'query');
  s1.close();
  await settle();
  t.mock.timers.tick(15000);
  assert.equal(await s2.next(), version(7)); // one stream left: still ticking
  assert.equal(queries.mock.callCount(), 1);
  s2.close();
  await settle();
  t.mock.timers.tick(15000);
  t.mock.timers.tick(15000);
  await settle();
  assert.equal(queries.mock.callCount(), 1);
});

test('a database error on a tick skips that tick; the stream stays open', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const app = await start(t);
  const s = await openStream(app.baseUrl, 'key-a-dev');
  t.after(s.close);
  await s.next();
  const errors = t.mock.method(console, 'error', () => {});
  const query = pool.query.bind(pool);
  const failing = t.mock.method(pool, 'query', async () => {
    throw new Error('connection lost');
  });
  t.mock.timers.tick(15000);
  await settle();
  assert.equal(errors.mock.callCount(), 1);
  failing.mock.mockImplementation(query);
  t.mock.timers.tick(15000);
  assert.equal(await s.next(), version(7));
});
