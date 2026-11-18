import { test } from 'node:test';
import assert from 'node:assert/strict';
import { murmur3_32, bucket, isInRollout } from '../src/bucket.js';

const utf8 = (s) => new TextEncoder().encode(s);
const users = Array.from({ length: 10000 }, (_, i) => `user-${i}`);

// Public MurmurHash3_x86_32 vectors.
test('murmur3_32 matches the public MurmurHash3 x86 32-bit vectors', () => {
  assert.equal(murmur3_32(utf8(''), 0), 0x00000000);
  assert.equal(murmur3_32(utf8(''), 1), 0x514e28b7);
  assert.equal(murmur3_32(utf8('hello'), 0), 0x248bfa47);
  assert.equal(murmur3_32(utf8('The quick brown fox jumps over the lazy dog'), 0), 0x2e4ff723);
});

// Reference vectors for D-004: murmur3_32(utf8(flag_key + ":" + user_id), 0) % 100.
// Values computed with an independent implementation (murmurhash3js-revisited 3.0.0),
// not with ../src/bucket.js. Changing them moves real users to other buckets.
test('bucket matches the reference vectors', () => {
  const vectors = [
    ['new-checkout', 'user-1', 31],
    ['new-checkout', 'user-2', 89],
    ['reserve-button-color', 'a1b2c3d4', 29],
    ['dark-mode', '42', 3],
    ['new-checkout', '', 21],
    ['reserve-button-color', 'ștefan-ăîâ', 55],
    ['flag', '用户', 25],
    ['parking-spot-recommendation-based-on-previous-reservations-and-time-of-day', 'user-1', 61],
  ];
  for (const [flagKey, userId, expected] of vectors) {
    assert.equal(bucket(flagKey, userId), expected, `${flagKey} + ${userId}`);
  }
});

test('bucket is deterministic and an integer in 0..99', () => {
  for (const u of users.slice(0, 1000)) {
    const b = bucket('new-checkout', u);
    assert.equal(bucket('new-checkout', u), b);
    assert.ok(Number.isInteger(b) && b >= 0 && b <= 99, `bucket ${b}`);
  }
});

test('raising the rollout from 10% to 30% keeps every user already included', () => {
  const in10 = users.filter((u) => isInRollout(bucket('new-checkout', u), 10));
  const in30 = new Set(users.filter((u) => isInRollout(bucket('new-checkout', u), 30)));
  assert.ok(in10.length > 0);
  for (const u of in10) assert.ok(in30.has(u), `${u} left the rollout`);
  assert.ok(in30.size > in10.length);
});

test('isInRollout covers the edges 0% and 100%', () => {
  assert.equal(isInRollout(0, 0), false);
  assert.equal(isInRollout(99, 100), true);
  assert.equal(isInRollout(9, 10), true);
  assert.equal(isInRollout(10, 10), false);
});

test('buckets are spread evenly: each decile holds 10% ± 1.5%', () => {
  const deciles = new Array(10).fill(0);
  for (const u of users) deciles[Math.floor(bucket('reserve-button-color', u) / 10)]++;
  for (const [i, n] of deciles.entries()) {
    assert.ok(Math.abs(n / users.length - 0.1) <= 0.015, `decile ${i}: ${n}`);
  }
});

test('different flags give a user independent buckets', () => {
  const both = users.filter((u) => bucket('flag-a', u) < 50 && bucket('flag-b', u) < 50).length;
  assert.ok(Math.abs(both / users.length - 0.25) <= 0.02, `both in lower half: ${both}`);
});

test('non-string flag_key or user_id throws TypeError', () => {
  assert.throws(() => bucket(undefined, 'u'), TypeError);
  assert.throws(() => bucket('f', 42), TypeError);
  assert.throws(() => bucket('f', null), TypeError);
});
