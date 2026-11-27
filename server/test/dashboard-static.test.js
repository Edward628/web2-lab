import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createApp } from '../src/app.js';

// The dashboard served from the server's origin (D-007, D-014): a fixed list of files
// (the four pages, the start page at /, the stylesheet, src/), never its tests or package.json. The pages
// themselves are public; the data behind them needs a session (C-007). No database.
let app;
before(async () => {
  const server = createApp({ pool: null }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  app = { baseUrl: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((r) => server.close(r)) };
});
after(() => app?.close());

const get = (path) => fetch(`${app.baseUrl}${path}`, { redirect: 'manual' });
const repoFile = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');

function assertFrameAndSniffHeaders(res, path) {
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff', path);
  assert.equal(res.headers.get('x-frame-options'), 'DENY', path);
  assert.equal(res.headers.get('content-security-policy'), "frame-ancestors 'none'", path);
}

test('GET /dashboard/ serves the flags page (DS-web2-flags); /dashboard redirects to /dashboard/', async () => {
  const res = await get('/dashboard/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/html/);
  assert.equal(await res.text(), await repoFile('dashboard/index.html'));
  assertFrameAndSniffHeaders(res, '/dashboard/');

  const redirect = await get('/dashboard');
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.get('location'), '/dashboard/');
});

test('GET / serves the start page (DS-web2-home) with the same headers', async () => {
  const res = await get('/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /^text\/html/);
  assert.equal(await res.text(), await repoFile('dashboard/home.html'));
  assertFrameAndSniffHeaders(res, '/');
});

test('the start page links P1 and the dashboard, each with its hint, and uses the dashboard stylesheet', async () => {
  const html = await repoFile('dashboard/home.html');
  assert.match(html, /<html lang="ro">/);
  assert.match(html, /<link rel="stylesheet" href="\/dashboard\/styles\.css">/);
  assert.match(html, /<a class="btn btn-primary" href="\/p1\/" aria-describedby="hint-p1">Aplicația demo \(P1\)<\/a>/);
  assert.match(html, /<p id="hint-p1" class="hint">Rezervă un loc de parcare\. Butonul face parte din experimentul A\/B\.<\/p>/);
  assert.match(html, /<a class="btn" href="\/dashboard\/" aria-describedby="hint-dash">Dashboard admin<\/a>/);
  assert.match(html, /<p id="hint-dash" class="hint">Flag-uri, kill switch, rezultate și jurnal de audit\. Necesită parola de admin\.<\/p>/);
  assert.doesNotMatch(html, /<script/, 'a static page, no scripts');
});

test('the login, experiment and audit pages, the stylesheet and the scripts are served with their content types and headers', async () => {
  for (const [path, file, type] of [
    ['/dashboard/login.html', 'dashboard/login.html', /^text\/html/],
    ['/dashboard/experiment.html', 'dashboard/experiment.html', /^text\/html/],
    ['/dashboard/audit.html', 'dashboard/audit.html', /^text\/html/],
    ['/dashboard/styles.css', 'dashboard/styles.css', /^text\/css/],
    ['/dashboard/src/app.js', 'dashboard/src/app.js', /^text\/javascript/],
    ['/dashboard/src/login.js', 'dashboard/src/login.js', /^text\/javascript/],
    ['/dashboard/src/api.js', 'dashboard/src/api.js', /^text\/javascript/],
    ['/dashboard/src/flags.js', 'dashboard/src/flags.js', /^text\/javascript/],
    ['/dashboard/src/experiment.js', 'dashboard/src/experiment.js', /^text\/javascript/],
    ['/dashboard/src/results.js', 'dashboard/src/results.js', /^text\/javascript/],
    ['/dashboard/src/audit.js', 'dashboard/src/audit.js', /^text\/javascript/],
    ['/dashboard/src/audit-text.js', 'dashboard/src/audit-text.js', /^text\/javascript/],
  ]) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get('content-type'), type, path);
    assert.equal(await res.text(), await repoFile(file), path);
    assertFrameAndSniffHeaders(res, path);
  }
});

test('nothing outside the list: tests, package.json, other files and traversal get 404', async () => {
  for (const path of [
    '/index.html',
    '/home.html',
    '/dashboard/home.html',
    '/dashboard/test/flags.test.js',
    '/dashboard/package.json',
    '/dashboard/index.html',
    '/dashboard/src/',
    '/dashboard/src/../package.json',
    '/dashboard/src/%2e%2e/package.json',
    '/dashboard/..%2f.env',
    '/dashboard/src/.hidden',
  ]) {
    const res = await get(path);
    assert.equal(res.status, 404, path);
  }
});
