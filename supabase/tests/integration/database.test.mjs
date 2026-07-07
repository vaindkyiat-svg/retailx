/**
 * RetailX V2 — Database integration tests (requires DATABASE_URL)
 * Skipped automatically when DATABASE_URL is not set.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  createClient,
  listMigrationFiles,
  getAppliedMigrations,
  resolveEnvironment,
} from '../../../scripts/infrastructure/lib/helpers.mjs';

const hasDatabase = !!process.env.DATABASE_URL;

describe('database integration', { skip: !hasDatabase }, () => {
  let client;

  before(async () => {
    client = await createClient(resolveEnvironment('development'));
  });

  after(async () => {
    if (client) await client.end();
  });

  it('migration_history table exists after migrations', async () => {
    const result = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'migration_history'
      )
    `);
    assert.equal(result.rows[0].exists, true);
  });

  it('all migrations are applied', async () => {
    const files = listMigrationFiles();
    const applied = await getAppliedMigrations(client, 'development');
    const appliedVersions = new Set(applied.map((m) => m.version));

    for (const file of files) {
      assert.ok(appliedVersions.has(file.version), `Migration not applied: ${file.filename}`);
    }
  });

  it('feature_flags table has required seeds', async () => {
    const result = await client.query(
      `SELECT key FROM public.feature_flags WHERE key IN (
        'USE_V2_PROVISIONING', 'USE_MEMBERSHIP_AUTH', 'USE_MEMBERSHIP_RLS', 'WRITE_LEGACY_CREDENTIALS'
      )`
    );
    assert.equal(result.rowCount, 4);
  });

  it('plans table has seed data', async () => {
    const result = await client.query(`SELECT COUNT(*)::int AS count FROM public.plans`);
    assert.ok(result.rows[0].count >= 4);
  });

  it('system_roles table has seed data', async () => {
    const result = await client.query(`SELECT COUNT(*)::int AS count FROM public.system_roles`);
    assert.ok(result.rows[0].count >= 6);
  });
});

if (!hasDatabase) {
  console.log('Skipping database integration tests — DATABASE_URL not set');
}
