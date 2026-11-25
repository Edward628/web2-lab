import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getUserId } from '../src/user-id.js';
import { memoryStorage, blockedStorage } from './helpers.js';

const HEX32 = /^[0-9a-f]{32}$/;

test('the first visit creates a 32-hex-digit id and stores it', () => {
  const storage = memoryStorage();
  const id = getUserId(storage);
  assert.match(id, HEX32);
  assert.deepEqual([...storage.data.values()], [id]);
});

test('later visits reuse the stored id', () => {
  const storage = memoryStorage();
  const first = getUserId(storage);
  assert.equal(getUserId(storage), first);
});

test('blocked storage gives a new id on each page load, without throwing', () => {
  const a = getUserId(blockedStorage());
  const b = getUserId(blockedStorage());
  assert.match(a, HEX32);
  assert.match(b, HEX32);
  assert.notEqual(a, b);
});

test('no storage at all gives a new id', () => {
  assert.match(getUserId(undefined), HEX32);
});

test('a failing write still returns the new id', () => {
  const storage = memoryStorage();
  storage.setItem = () => {
    throw new Error('QuotaExceededError');
  };
  assert.match(getUserId(storage), HEX32);
});
