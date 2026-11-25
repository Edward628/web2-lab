import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidConfig } from '../src/validate.js';

// A valid configuration in the C-001 shape.
const valid = () => ({
  version: 7,
  flags: {
    'new-checkout': {
      type: 'boolean',
      enabled: true,
      default: false,
      rules: [{ attribute: 'country', operator: 'in', values: ['RO'], serve: true }],
      variants: [{ value: true, from: 0, to: 30 }],
    },
    empty: { type: 'boolean', enabled: false, default: false, rules: [], variants: [] },
  },
});

test('a valid C-001 configuration is accepted, empty rules and variants included', () => {
  assert.equal(isValidConfig(valid()), true);
  assert.equal(isValidConfig({ version: 1, flags: {} }), true);
});

test('a configuration that is not an object is rejected', () => {
  for (const c of [undefined, null, 7, 'x', [], true]) {
    assert.equal(isValidConfig(c), false, String(c));
  }
});

test('version must be a finite number', () => {
  for (const version of [undefined, '7', NaN, Infinity, null]) {
    assert.equal(isValidConfig({ ...valid(), version }), false, String(version));
  }
});

test('flags must be a non-null, non-array object', () => {
  for (const flags of [undefined, null, [], 'x', 3]) {
    assert.equal(isValidConfig({ version: 1, flags }), false, String(flags));
  }
});

test('every flag must be an object', () => {
  for (const flag of [null, [], 'on', true, 1]) {
    const c = valid();
    c.flags.bad = flag;
    assert.equal(isValidConfig(c), false, String(flag));
  }
});

test('rules and variants must be arrays, and are required', () => {
  for (const key of ['rules', 'variants']) {
    for (const v of [undefined, null, {}, 'x']) {
      const c = valid();
      c.flags['new-checkout'][key] = v;
      assert.equal(isValidConfig(c), false, `${key} = ${String(v)}`);
    }
    const c = valid();
    delete c.flags['new-checkout'][key];
    assert.equal(isValidConfig(c), false, `${key} missing`);
  }
});

test('every rule and every variant must be an object', () => {
  for (const key of ['rules', 'variants']) {
    for (const item of [null, 'x', 3, []]) {
      const c = valid();
      c.flags['new-checkout'][key].push(item);
      assert.equal(isValidConfig(c), false, `${key} item ${String(item)}`);
    }
  }
});

test('from and to must be finite numbers', () => {
  for (const key of ['from', 'to']) {
    for (const v of ['0', NaN, Infinity, null, undefined]) {
      const c = valid();
      c.flags['new-checkout'].variants[0][key] = v;
      assert.equal(isValidConfig(c), false, `${key} = ${String(v)}`);
    }
    const c = valid();
    delete c.flags['new-checkout'].variants[0][key];
    assert.equal(isValidConfig(c), false, `${key} missing`);
  }
});
