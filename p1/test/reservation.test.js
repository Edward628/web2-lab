import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPOTS, loadReservation, reserve, cancel, variantOf } from '../src/reservation.js';
import { memoryStorage, blockedStorage } from './helpers.js';

const HOUR = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 25, 12, 0, 0);

function tracker() {
  const calls = [];
  const track = (metric) => calls.push(metric);
  return { calls, track };
}

test('SPOTS are the six spots of the mock, three of them free', () => {
  assert.deepEqual(
    SPOTS.map((s) => [s.id, s.free]),
    [
      ['A12', true],
      ['A13', false],
      ['B03', true],
      ['B04', false],
      ['C01-ELECTRIC-INCARCARE-RAPIDA', true],
      ['C02', false],
    ],
  );
  for (const s of SPOTS) assert.equal(typeof s.where, 'string');
});

test('reserve without a chosen spot is invalid: nothing stored, nothing tracked', () => {
  const storage = memoryStorage();
  const { calls, track } = tracker();
  assert.equal(reserve(storage, null, track, NOW), 'invalid');
  assert.equal(storage.data.size, 0);
  assert.deepEqual(calls, []);
});

test('reserve on a taken or unknown spot is invalid and not tracked', () => {
  const storage = memoryStorage();
  const { calls, track } = tracker();
  assert.equal(reserve(storage, 'A13', track, NOW), 'invalid');
  assert.equal(reserve(storage, 'Z99', track, NOW), 'invalid');
  assert.equal(storage.data.size, 0);
  assert.deepEqual(calls, []);
});

test('reserve on a free spot holds it for one hour and tracks reserve_click once', () => {
  const storage = memoryStorage();
  const { calls, track } = tracker();
  const r = reserve(storage, 'B03', track, NOW);
  assert.deepEqual(r, { spotId: 'B03', until: NOW + HOUR });
  assert.deepEqual(calls, ['reserve_click']);
  assert.deepEqual(loadReservation(storage, NOW + 1), r);
});

test('the reservation survives a reload until it expires', () => {
  const storage = memoryStorage();
  reserve(storage, 'A12', () => {}, NOW);
  assert.deepEqual(loadReservation(storage, NOW + HOUR - 1), { spotId: 'A12', until: NOW + HOUR });
  assert.equal(loadReservation(storage, NOW + HOUR), null);
  assert.equal(storage.data.size, 0);
});

test('loadReservation gives null when nothing is stored, the value is unreadable, or storage is blocked', () => {
  assert.equal(loadReservation(memoryStorage(), NOW), null);
  const [key] = (() => {
    const s = memoryStorage();
    reserve(s, 'A12', () => {}, NOW);
    return [...s.data.keys()];
  })();
  assert.equal(loadReservation(memoryStorage({ [key]: 'not json' }), NOW), null);
  assert.equal(loadReservation(memoryStorage({ [key]: '{"spotId":"A12"}' }), NOW), null);
  assert.equal(loadReservation(blockedStorage(), NOW), null);
  assert.equal(loadReservation(undefined, NOW), null);
});

test('reserve still succeeds and tracks when storage is blocked', () => {
  const { calls, track } = tracker();
  assert.deepEqual(reserve(blockedStorage(), 'A12', track, NOW), { spotId: 'A12', until: NOW + HOUR });
  assert.deepEqual(calls, ['reserve_click']);
});

test('cancel removes the reservation and never throws', () => {
  const storage = memoryStorage();
  reserve(storage, 'A12', () => {}, NOW);
  cancel(storage);
  assert.equal(loadReservation(storage, NOW), null);
  assert.doesNotThrow(() => cancel(blockedStorage()));
  assert.doesNotThrow(() => cancel(undefined));
});

test('variantOf: green is green, anything else is the control (blue)', () => {
  assert.equal(variantOf('green'), 'green');
  for (const v of ['blue', 'red', null, undefined, true]) assert.equal(variantOf(v), 'blue');
});
