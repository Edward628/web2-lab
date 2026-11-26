import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createApp } from '../src/app.js';

// P1 served from the server's origin (D-014, D-015): a fixed list of files, and
// /p1/config.js generated from P1_SDK_KEY. No database is touched, so no pool.
const KEY = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
let withKey;
let withoutKey;

async function start(options) {
  const server = createApp({ pool: null, ...options }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { baseUrl, close: () => new Promise((r) => server.close(r)) };
}

before(async () => {
  withKey = await start({ p1SdkKey: KEY });
  withoutKey = await start({});
});
after(async () => {
  await withKey?.close();
  await withoutKey?.close();
});

const get = (app, path) => fetch(`${app.baseUrl}${path}`, { redirect: 'manual' });
const repoFile = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

test('GET /p1/ serves the P1 page; /p1 redirects to /p1/', async () => {
  const res = await get(withKey, '/p1/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/html/);
  assert.equal(await res.text(), await repoFile('p1/index.html'));

  const redirect = await get(withKey, '/p1');
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get('location'), '/p1/');
});

test('P1 scripts, the stylesheet and the SDK sources are served with their content types', async () => {
  for (const [path, file, type] of [
    ['/p1/src/app.js', 'p1/src/app.js', /^text\/javascript/],
    ['/p1/src/variant.js', 'p1/src/variant.js', /^text\/javascript/],
    ['/sdk/src/index.js', 'sdk/src/index.js', /^text\/javascript/],
    ['/sdk/src/events.js', 'sdk/src/events.js', /^text\/javascript/],
    ['/p1/styles.css', 'p1/styles.css', /^text\/css/],
  ]) {
    const res = await get(withKey, path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get('content-type'), type, path);
    assert.equal(await res.text(), await repoFile(file), path);
  }
});

test('with P1_SDK_KEY, /p1/config.js exports that key and baseUrl = location.origin', async () => {
  const res = await get(withKey, '/p1/config.js');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/javascript/);
  assert.equal(res.headers.get('cache-control'), 'no-cache');
  const body = await res.text();
  assert.equal(body, `export const sdkKey = "${KEY}";\nexport const baseUrl = location.origin;\n`);
});

test('the key is written as a JavaScript string literal', async () => {
  const app = await start({ p1SdkKey: 'a"b\\c</script>' });
  try {
    const body = await (await get(app, '/p1/config.js')).text();
    assert.equal(body.split('\n')[0], `export const sdkKey = ${JSON.stringify('a"b\\c</script>')};`);
  } finally {
    await app.close();
  }
});

test('without P1_SDK_KEY, /p1/config.js is 404 (P1 then shows the control)', async () => {
  assert.equal((await get(withoutKey, '/p1/config.js')).status, 404);
  assert.equal((await get(withoutKey, '/p1/')).status, 200);
});

test('nothing outside the fixed list is served: repo root, .env, tests, package files, server code', async () => {
  for (const path of [
    '/',
    '/.env',
    '/.env.example',
    '/p1/test/helpers.js',
    '/p1/package.json',
    '/p1/config.example.js',
    '/sdk/package.json',
    '/sdk/test/client.test.js',
    '/server/src/app.js',
    '/server/package.json',
    '/sdk/src/%2e%2e/package.json',
    '/p1/src/%2e%2e/%2e%2e/.env',
    '/p1/src/..%2f..%2f.env',
    '/sdk/src/.hidden',
  ]) {
    const res = await get(withKey, path);
    assert.equal(res.status, 404, path);
  }
});

test('P1 responses carry nosniff and frame protection', async () => {
  for (const path of ['/p1/', '/p1/styles.css', '/p1/config.js', '/p1/src/app.js', '/sdk/src/index.js']) {
    const res = await get(withKey, path);
    assert.equal(res.status, 200, path);
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff', path);
    assert.equal(res.headers.get('x-frame-options'), 'DENY', path);
    assert.equal(res.headers.get('content-security-policy'), "frame-ancestors 'none'", path);
  }
});

test('no X-Powered-By header, on P1 or on the SDK endpoints', async () => {
  for (const path of ['/p1/', '/p1/config.js', '/sdk/src/index.js', '/sdk/config', '/nothing-here']) {
    const res = await get(withKey, path);
    assert.equal(res.headers.get('x-powered-by'), null, path);
  }
});
