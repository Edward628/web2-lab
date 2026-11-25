import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { init } from '../src/index.js';

// refresh() against a local server that plays the C-002 endpoint.
// new-checkout + user-1 = bucket 31 (bucket.test.js).
const configV = (version, to) => ({
  version,
  flags: {
    'new-checkout': { type: 'boolean', enabled: true, default: false, rules: [], variants: [{ value: true, from: 0, to }] },
  },
});

// Starts a server; `respond(req)` returns { status, etag?, body? } (body: object or raw string).
async function serve(respond) {
  const requests = [];
  const server = createServer((req, res) => {
    requests.push({ url: req.url, ifNoneMatch: req.headers['if-none-match'] });
    const { status, etag, body } = respond(req);
    const headers = etag === undefined ? {} : { ETag: etag };
    res.writeHead(status, headers);
    res.end(body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return { baseUrl, requests, close: () => new Promise((r) => server.close(r)) };
}

test('200 updates the configuration; the key is sent URL-encoded in the query', async (t) => {
  const s = await serve(() => ({ status: 200, etag: '"7"', body: configV(7, 100) }));
  t.after(s.close);
  const ff = init({ sdkKey: 'sdk dev/1', baseUrl: s.baseUrl });
  ff.identify('user-1');
  assert.equal(ff.isEnabled('new-checkout'), false); // no configuration yet
  assert.equal(await ff.refresh(), 'updated');
  assert.equal(ff.isEnabled('new-checkout'), true);
  assert.equal(s.requests[0].url, '/sdk/config?key=sdk%20dev%2F1');
  assert.equal(s.requests[0].ifNoneMatch, undefined);
});

test('the next request sends If-None-Match with the ETag received; 304 keeps the configuration', async (t) => {
  let n = 0;
  const s = await serve(() => (n++ === 0 ? { status: 200, etag: '"7"', body: configV(7, 100) } : { status: 304, etag: '"7"' }));
  t.after(s.close);
  const ff = init({ sdkKey: 'k', baseUrl: s.baseUrl });
  ff.identify('user-1');
  assert.equal(await ff.refresh(), 'updated');
  assert.equal(await ff.refresh(), 'not-modified');
  assert.equal(s.requests[1].ifNoneMatch, '"7"');
  assert.equal(ff.isEnabled('new-checkout'), true);
});

test('a new version replaces the old one', async (t) => {
  let n = 0;
  const s = await serve(() => (n++ === 0 ? { status: 200, etag: '"7"', body: configV(7, 100) } : { status: 200, etag: '"8"', body: configV(8, 30) }));
  t.after(s.close);
  const ff = init({ sdkKey: 'k', baseUrl: s.baseUrl });
  ff.identify('user-1');
  await ff.refresh();
  assert.equal(await ff.refresh(), 'updated');
  assert.equal(ff.isEnabled('new-checkout'), false); // bucket 31, rollout 30
});

test('an invalid configuration or a non-JSON body is rejected; the last valid one and its ETag stay', async (t) => {
  const bad = { version: 8, flags: { 'new-checkout': { enabled: true, default: false, rules: [], variants: [{ value: true, from: '0', to: 30 }] } } };
  const responses = [
    { status: 200, etag: '"7"', body: configV(7, 100) },
    { status: 200, etag: '"8"', body: bad },
    { status: 200, etag: '"9"', body: 'not json {' },
    { status: 304, etag: '"7"' },
  ];
  let n = 0;
  const s = await serve(() => responses[n++]);
  t.after(s.close);
  const ff = init({ sdkKey: 'k', baseUrl: s.baseUrl });
  ff.identify('user-1');
  assert.equal(await ff.refresh(), 'updated');
  assert.equal(await ff.refresh(), 'rejected');
  assert.equal(ff.isEnabled('new-checkout'), true);
  assert.equal(await ff.refresh(), 'rejected');
  assert.equal(ff.isEnabled('new-checkout'), true);
  assert.equal(await ff.refresh(), 'not-modified');
  assert.deepEqual(s.requests.map((r) => r.ifNoneMatch), [undefined, '"7"', '"7"', '"7"']);
});

test('a server error keeps the configuration and does not throw', async (t) => {
  let n = 0;
  const s = await serve(() => (n++ === 0 ? { status: 200, etag: '"7"', body: configV(7, 100) } : { status: 500, body: 'boom' }));
  t.after(s.close);
  const ff = init({ sdkKey: 'k', baseUrl: s.baseUrl });
  ff.identify('user-1');
  await ff.refresh();
  assert.equal(await ff.refresh(), 'error');
  assert.equal(ff.isEnabled('new-checkout'), true);
});

test('an unreachable server or no baseUrl gives error, without throwing', async () => {
  const s = await serve(() => ({ status: 200 }));
  const { baseUrl } = s;
  await s.close();
  const ff = init({ sdkKey: 'k', baseUrl, config: configV(7, 100) });
  ff.identify('user-1');
  assert.equal(await ff.refresh(), 'error');
  assert.equal(ff.isEnabled('new-checkout'), true);
  assert.equal(await init({ sdkKey: 'k' }).refresh(), 'error');
});
