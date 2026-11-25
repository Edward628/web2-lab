import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { init } from '../../sdk/src/index.js';
import { testPool, reset, seed, listen } from './helpers.js';

// Both sides of C-002: the real SDK refresh() against the real server.
const pool = testPool();
let app;
before(async () => {
  await reset(pool);
  await seed(pool);
  app = await listen(pool);
});
after(async () => {
  await app?.close();
  await pool.end();
});

test('the SDK gets the configuration, then 304 on the next refresh', async () => {
  const ff = init({ sdkKey: 'key-a-dev', baseUrl: app.baseUrl });
  ff.identify('user-1', { country: 'RO' });
  assert.equal(ff.isEnabled('new-checkout'), false); // no configuration yet
  assert.equal(await ff.refresh(), 'updated');
  assert.equal(ff.isEnabled('new-checkout'), true); // rule country in [RO, MD]
  assert.equal(ff.getVariant('reserve-button-color'), 'blue'); // reserve-button-color + user-1 = bucket 40
  assert.equal(await ff.refresh(), 'not-modified');
});

test('an unknown key is an error for the SDK', async () => {
  const ff = init({ sdkKey: 'no-such-key', baseUrl: app.baseUrl });
  assert.equal(await ff.refresh(), 'error');
});
