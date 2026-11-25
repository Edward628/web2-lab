import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../src/evaluate.js';

// Buckets from the reference vectors in bucket.test.js (D-004):
// new-checkout + user-1 = 31, new-checkout + user-2 = 89.
const user1 = { userId: 'user-1', attributes: {} };
const user2 = { userId: 'user-2', attributes: {} };

const colors = () => ({
  type: 'multivariate',
  enabled: true,
  default: 'blue',
  rules: [],
  variants: [
    { value: 'blue', from: 0, to: 50 },
    { value: 'green', from: 50, to: 100 },
  ],
});

test('a flag that is off serves default, even when a rule matches', () => {
  const flag = {
    ...colors(),
    enabled: false,
    rules: [{ attribute: 'plan', operator: 'equals', value: 'beta', serve: 'green' }],
  };
  const user = { userId: 'user-2', attributes: { plan: 'beta' } };
  assert.equal(evaluate('new-checkout', flag, user), 'blue');
});

test('rules run in order and the first match serves its value', () => {
  const flag = {
    ...colors(),
    rules: [
      { attribute: 'country', operator: 'in', values: ['RO', 'MD'], serve: 'red' },
      { attribute: 'plan', operator: 'equals', value: 'beta', serve: 'green' },
    ],
  };
  const both = { userId: 'user-1', attributes: { country: 'MD', plan: 'beta' } };
  const beta = { userId: 'user-1', attributes: { country: 'DE', plan: 'beta' } };
  assert.equal(evaluate('new-checkout', flag, both), 'red');
  assert.equal(evaluate('new-checkout', flag, beta), 'green');
});

test('equals is strict and in checks the list', () => {
  const flag = {
    ...colors(),
    rules: [
      { attribute: 'age', operator: 'equals', value: 42, serve: 'green' },
      { attribute: 'country', operator: 'in', values: ['RO'], serve: 'red' },
    ],
  };
  // user-1 falls in blue (bucket 31), so a non-match is visible.
  assert.equal(evaluate('new-checkout', flag, { userId: 'user-1', attributes: { age: '42' } }), 'blue');
  assert.equal(evaluate('new-checkout', flag, { userId: 'user-1', attributes: { age: 42 } }), 'green');
  assert.equal(evaluate('new-checkout', flag, { userId: 'user-1', attributes: { country: 'RO' } }), 'red');
  assert.equal(evaluate('new-checkout', flag, { userId: 'user-1', attributes: { country: 'R' } }), 'blue');
});

test('a rule on a missing attribute or with an unknown operator does not match', () => {
  const flag = {
    ...colors(),
    rules: [
      { attribute: 'plan', operator: 'equals', value: undefined, serve: 'green' },
      { attribute: 'plan', operator: 'startsWith', value: 'be', serve: 'green' },
    ],
  };
  assert.equal(evaluate('new-checkout', flag, user1), 'blue');
  assert.equal(evaluate('new-checkout', flag, { userId: 'user-1', attributes: { plan: 'beta' } }), 'blue');
});

test('the variant is chosen by bucket', () => {
  assert.equal(evaluate('new-checkout', colors(), user1), 'blue'); // 31 in [0, 50)
  assert.equal(evaluate('new-checkout', colors(), user2), 'green'); // 89 in [50, 100)
});

test('ranges include from, exclude to; an uncovered bucket serves default', () => {
  const flag = (from, to) => ({ ...colors(), default: 'none', variants: [{ value: 'x', from, to }] });
  assert.equal(evaluate('new-checkout', flag(31, 32), user1), 'x');
  assert.equal(evaluate('new-checkout', flag(30, 31), user1), 'none');
  assert.equal(evaluate('new-checkout', flag(0, 31), user1), 'none');
});

test('boolean rollout: 30% excludes bucket 31, 32% includes it', () => {
  const rollout = (n) => ({
    type: 'boolean',
    enabled: true,
    default: false,
    rules: [],
    variants: [{ value: true, from: 0, to: n }],
  });
  assert.equal(evaluate('new-checkout', rollout(30), user1), false);
  assert.equal(evaluate('new-checkout', rollout(32), user1), true);
});
