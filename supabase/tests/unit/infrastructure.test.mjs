/**
 * RetailX V2 — Infrastructure unit tests (no database required)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  listMigrationFiles,
  validateMigrationFiles,
  parseMigrationFilename,
  checksum,
  listSeedFiles,
  loadEnvironments,
  getProjectRoot,
} from '../../../scripts/infrastructure/lib/helpers.mjs';

describe('migration pipeline', () => {
  it('lists all migration files in order', () => {
    const files = listMigrationFiles();
    assert.ok(files.length >= 19, 'Expected at least 19 migrations (through admin shops RLS)');

    for (let i = 1; i < files.length; i++) {
      assert.ok(
        files[i].version > files[i - 1].version,
        `Migrations must be sorted: ${files[i - 1].filename} before ${files[i].filename}`
      );
    }
  });

  it('validates migration filenames', () => {
    assert.deepEqual(parseMigrationFilename('20260707100000_extensions_and_enums.sql'), {
      version: '20260707100000',
      name: 'extensions_and_enums',
    });
    assert.equal(parseMigrationFilename('invalid.sql'), null);
  });

  it('passes migration validation', () => {
    const files = listMigrationFiles();
    assert.doesNotThrow(() => validateMigrationFiles(files));
  });

  it('generates stable checksums', () => {
    const content = 'SELECT 1;';
    assert.equal(checksum(content), checksum(content));
    assert.notEqual(checksum('a'), checksum('b'));
  });

  it('has rollback files for each migration', () => {
    const files = listMigrationFiles();
    const rollbackDir = join(getProjectRoot(), 'supabase', 'migrations', 'rollback');
    const rollbacks = readdirSync(rollbackDir).filter((f) => f.endsWith('.sql'));

    for (const migration of files) {
      const match = rollbacks.find((r) => r.startsWith(migration.version));
      assert.ok(match, `Missing rollback for ${migration.filename}`);
    }
  });

  it('migration files include header comments', () => {
    const files = listMigrationFiles();
    for (const file of files) {
      const content = readFileSync(file.path, 'utf8');
      assert.ok(content.includes('-- Migration:'), `${file.filename} missing header`);
    }
  });
});

describe('seed infrastructure', () => {
  it('lists seed files in order', () => {
    const seeds = listSeedFiles();
    assert.equal(seeds.length, 6);
    assert.ok(seeds[0].includes('01_roles'));
    assert.ok(seeds[seeds.length - 1].includes('06_feature_flags'));
  });

  it('seed files use ON CONFLICT for idempotency', () => {
    const seeds = listSeedFiles();
    for (const file of seeds) {
      const content = readFileSync(file, 'utf8');
      assert.ok(
        content.includes('ON CONFLICT'),
        `${file} must use ON CONFLICT for idempotent seeds`
      );
    }
  });

  it('feature flag seed defines required flags', () => {
    const flagSeed = readFileSync(
      join(getProjectRoot(), 'supabase', 'seed', '06_feature_flags.sql'),
      'utf8'
    );
    const required = [
      'USE_V2_PROVISIONING',
      'USE_MEMBERSHIP_AUTH',
      'USE_MEMBERSHIP_RLS',
      'WRITE_LEGACY_CREDENTIALS',
    ];
    for (const flag of required) {
      assert.ok(flagSeed.includes(flag), `Missing flag seed: ${flag}`);
    }
  });
});

describe('environment config', () => {
  it('defines development, staging, production', () => {
    const envs = loadEnvironments();
    assert.ok(envs.development);
    assert.ok(envs.staging);
    assert.ok(envs.production);
    assert.equal(envs.production.requireConfirmation, true);
  });
});

describe('supabase folder structure', () => {
  const root = getProjectRoot();

  const requiredPaths = [
    'supabase/config.toml',
    'supabase/config/environments.json',
    'supabase/migrations',
    'supabase/migrations/rollback',
    'supabase/seed',
    'supabase/functions',
    'supabase/functions/_shared',
    'supabase/functions/health',
    'supabase/tests',
    'scripts/infrastructure',
  ];

  for (const rel of requiredPaths) {
    it(`exists: ${rel}`, () => {
      assert.ok(existsSync(join(root, rel)), `Missing: ${rel}`);
    });
  }
});
