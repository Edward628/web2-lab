import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseHash } from '../src/admin.js';

// `npm run hash-password` (D-019): at least 12 characters, else nothing is printed.
// The password is piped (stdin is not a terminal here); these are test values.
const script = fileURLToPath(new URL('../scripts/hash-password.js', import.meta.url));
const run = (input) => spawnSync(process.execPath, [script], { input, encoding: 'utf8' });

test('12 characters or more: prints one valid hash and exits 0', () => {
  for (const password of ['twelve chars', 'ăîșțâ-1234567']) {
    const r = run(`${password}\n`);
    assert.equal(r.status, 0, r.stderr);
    assert.notEqual(parseHash(r.stdout.trim()), null, r.stdout);
    assert.ok(!r.stdout.includes(password) && !r.stderr.includes(password));
  }
});

test('fewer than 12 characters (counted as characters, not bytes) or empty: exits 1, prints no hash', () => {
  for (const password of ['', 'short', 'eleven char', 'ăîșțâăîșțâă']) {
    const r = run(`${password}\n`);
    assert.equal(r.status, 1, JSON.stringify(password));
    assert.equal(r.stdout, '', JSON.stringify(password));
    assert.match(r.stderr, /12/, JSON.stringify(password));
    if (password) assert.ok(!r.stderr.includes(password));
  }
});
