import { test } from 'node:test';
import assert from 'node:assert/strict';
import { init } from '../src/index.js';

// Configuration in the C-001 shape. Buckets (bucket.test.js):
// new-checkout + user-1 = 31, reserve-button-color + a1b2c3d4 = 29.
const config = () => ({
  version: 7,
  flags: {
    'new-checkout': {
      type: 'boolean',
      enabled: true,
      default: false,
      rules: [{ attribute: 'country', operator: 'in', values: ['RO', 'MD'], serve: true }],
      variants: [{ value: true, from: 0, to: 30 }],
    },
    'reserve-button-color': {
      type: 'multivariate',
      enabled: true,
      default: 'blue',
      rules: [{ attribute: 'plan', operator: 'equals', value: 'beta', serve: 'green' }],
      variants: [
        { value: 'blue', from: 0, to: 50 },
        { value: 'green', from: 50, to: 100 },
      ],
    },
  },
});

test('init keeps the SDK key', () => {
  const ff = init({ sdkKey: 'sdk-dev-123', config: config() });
  assert.equal(ff.sdkKey, 'sdk-dev-123');
});

test('identify with a non-string user id throws TypeError', () => {
  const ff = init({ sdkKey: 'k', config: config() });
  assert.throws(() => ff.identify(42), TypeError);
  assert.throws(() => ff.identify(undefined), TypeError);
  assert.throws(() => ff.identify(null, {}), TypeError);
});

test('before identify, a flag serves its default', () => {
  const ff = init({ sdkKey: 'k', config: config() });
  assert.equal(ff.isEnabled('new-checkout'), false);
  assert.equal(ff.getVariant('reserve-button-color'), 'blue');
});

test('an unknown flag gives false and null, without throwing', () => {
  const ff = init({ sdkKey: 'k', config: config() });
  ff.identify('user-1');
  assert.equal(ff.isEnabled('no-such-flag'), false);
  assert.equal(ff.getVariant('no-such-flag'), null);
});

test('isEnabled is value === true; getVariant returns the value for any flag', () => {
  const ff = init({ sdkKey: 'k', config: config() });
  ff.identify('a1b2c3d4');
  assert.equal(ff.getVariant('reserve-button-color'), 'blue'); // bucket 29
  assert.equal(ff.isEnabled('reserve-button-color'), false); // 'blue' !== true
  ff.identify('user-1', { country: 'RO' });
  assert.equal(ff.getVariant('new-checkout'), true);
  assert.equal(ff.isEnabled('new-checkout'), true);
});

test('identify again with new attributes changes the rule result', () => {
  const ff = init({ sdkKey: 'k', config: config() });
  ff.identify('user-1', { country: 'DE' });
  assert.equal(ff.isEnabled('new-checkout'), false); // bucket 31, rollout 30
  ff.identify('user-1', { country: 'MD' });
  assert.equal(ff.isEnabled('new-checkout'), true);
  ff.identify('user-1');
  assert.equal(ff.isEnabled('new-checkout'), false);
});

test('two clients do not share state', () => {
  const a = init({ sdkKey: 'a', config: config() });
  const b = init({ sdkKey: 'b', config: config() });
  a.identify('user-1', { country: 'RO' });
  assert.equal(a.isEnabled('new-checkout'), true);
  assert.equal(b.isEnabled('new-checkout'), false); // b has no user yet
  assert.equal(b.sdkKey, 'b');
});

test('a flag key that is an inherited object property is still unknown', () => {
  const ff = init({ sdkKey: 'k', config: config() });
  assert.equal(ff.getVariant('toString'), null);
  assert.equal(ff.getVariant('__proto__'), null);
  ff.identify('user-1');
  assert.equal(ff.getVariant('constructor'), null);
  assert.equal(ff.isEnabled('hasOwnProperty'), false);
});

test('a non-string flag key is unknown, before and after identify', () => {
  const flags = {
    '1': { type: 'boolean', enabled: true, default: false, rules: [], variants: [{ value: true, from: 0, to: 100 }] },
  };
  const ff = init({ sdkKey: 'k', config: { version: 1, flags } });
  assert.equal(ff.getVariant(1), null);
  ff.identify('user-1');
  assert.equal(ff.getVariant(1), null);
  assert.equal(ff.isEnabled({ toString: () => '1' }), false);
  assert.equal(ff.getVariant('1'), true);
});

test('init with an invalid configuration throws TypeError', () => {
  assert.throws(() => init({ sdkKey: 'k', config: { version: 1, flags: [] } }), TypeError);
  assert.throws(() => init({ sdkKey: 'k', config: { version: '1', flags: {} } }), TypeError);
  assert.throws(() => init({ sdkKey: 'k', config: null }), TypeError);
});

test('without a configuration every flag is unknown', () => {
  const ff = init({ sdkKey: 'k' });
  assert.equal(ff.isEnabled('new-checkout'), false);
  ff.identify('user-1');
  assert.equal(ff.getVariant('new-checkout'), null);
});
