import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildConfig } from '../src/config.js';
import { testPool, reset, seed } from './helpers.js';

// Q-028, D-020: buildConfig reads the version and the flags from one snapshot, so a
// write that commits between its two reads cannot pair new flags with the old ETag.
const pool = testPool();
before(() => reset(pool));
beforeEach(async () => {
  await reset(pool);
  await seed(pool);
});
after(() => pool.end());

// A change that commits on its own connection: new-checkout off in dev, version 7 → 8.
const write = () =>
  pool.query(`UPDATE flag_environments SET enabled = false WHERE flag_id = 1 AND environment_id = 1;
              UPDATE environments SET config_version = config_version + 1 WHERE id = 1`);

// A pool (and its clients) that runs `write` right after the query that finds the key
// (the version read) returns, whether buildConfig uses pool.query or a client.
function racingPool() {
  let raced = false;
  const race = async (result, text) => {
    if (!raced && /sdk_keys/.test(text)) {
      raced = true;
      await write();
    }
    return result;
  };
  const wrap = (target) => ({
    query: async (text, ...rest) => race(await target.query(text, ...rest), String(text?.text ?? text)),
  });
  return {
    ...wrap(pool),
    connect: async () => {
      const client = await pool.connect();
      return { ...wrap(client), release: (...args) => client.release(...args) };
    },
    wasRaced: () => raced,
  };
}

test('a write committed between the version and the flags reads: the result is still all from before it', async () => {
  const racing = racingPool();
  const config = await buildConfig(racing, 'key-a-dev');
  assert.equal(racing.wasRaced(), true, 'the write ran in the middle of buildConfig');
  assert.equal(config.version, 7);
  assert.equal(config.flags['new-checkout'].enabled, true);

  // The next read sees the write, with its version.
  const next = await buildConfig(pool, 'key-a-dev');
  assert.equal(next.version, 8);
  assert.equal(next.flags['new-checkout'].enabled, false);
});

// The pool holds 10 clients: a leaked client per call would block the 11th call.
test('buildConfig returns its client to the pool, also for an unknown key', { timeout: 10_000 }, async () => {
  for (let i = 0; i < 15; i++) {
    await buildConfig(pool, i % 2 ? 'key-a-dev' : 'no-such-key');
  }
  assert.equal(pool.waitingCount, 0);
  assert.equal(pool.idleCount, pool.totalCount);
});
