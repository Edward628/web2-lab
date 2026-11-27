import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as source from '../src/index.js';

// D-007: the SDK ships as an `npm pack` tarball. Pack it, install the tarball in an
// empty folder, and import it there by its package name, as another app would.
const sdkDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const npm = (args, cwd) =>
  execFileSync('npm', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

test('npm pack makes a tarball with only package.json and src/, installable and importable by name', (t) => {
  const tmp = mkdtempSync(join(tmpdir(), 'sdk-pack-'));
  t.after(() => rmSync(tmp, { recursive: true, force: true }));
  const out = join(tmp, 'out');
  const app = join(tmp, 'app');
  execFileSync('mkdir', ['-p', out, app]);

  const [packed] = JSON.parse(npm(['pack', '--json', '--pack-destination', out], sdkDir));
  assert.equal(packed.name, 'web2-lab-sdk');
  assert.equal(packed.version, '0.1.0');
  assert.equal(packed.filename, 'web2-lab-sdk-0.1.0.tgz');

  const srcFiles = readdirSync(join(sdkDir, 'src')).map((f) => `src/${f}`);
  const files = packed.files.map((f) => f.path).sort();
  assert.deepEqual(files, ['package.json', ...srcFiles].sort());

  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'app', private: true, type: 'module' }));
  npm(['install', '--no-audit', '--no-fund', join(out, packed.filename)], app);
  writeFileSync(
    join(app, 'check.js'),
    "import * as sdk from 'web2-lab-sdk';\nconsole.log(JSON.stringify(Object.keys(sdk).map((k) => [k, typeof sdk[k]])));\n",
  );
  const exported = JSON.parse(execFileSync(process.execPath, ['check.js'], { cwd: app, encoding: 'utf8' }));
  assert.deepEqual(exported, Object.keys(source).map((k) => [k, typeof source[k]]));
  assert.deepEqual(exported, [['init', 'function']]);
});
