/**
 * RetailX V2 Sprint E2 — Golden path file structure tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectRoot } from '../../../scripts/infrastructure/lib/helpers.mjs';

const root = getProjectRoot();

describe('Sprint E2 golden path validation', () => {
  const required = [
    'scripts/golden-path/run.mjs',
    'scripts/golden-path/lib/golden-path.mjs',
    'scripts/golden-path/lib/negative.mjs',
    'scripts/golden-path/lib/report.mjs',
    'scripts/golden-path/lib/provisioning.mjs',
    'scripts/golden-path/lib/assertions.mjs',
    'docs/GOLDEN_PATH.md',
  ];

  for (const file of required) {
    it(`exists: ${file}`, () => {
      assert.ok(existsSync(join(root, file)), `Missing ${file}`);
    });
  }

  it('package.json defines golden-path script', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    assert.ok(pkg.scripts['golden-path'], 'npm run golden-path script missing');
  });
});
