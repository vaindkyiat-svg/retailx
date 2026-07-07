/**
 * RetailX V2 Milestone C1 — Backfill integration tests
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  createClient,
  resolveEnvironment,
  getProjectRoot,
  withTransaction,
  listMigrationFiles,
  listSeedFiles,
} from '../../../scripts/infrastructure/lib/helpers.mjs';
import {
  backfillMemberships,
  backfillBranches,
  backfillWarehouses,
  backfillShopSettings,
  backfillSubscriptions,
} from '../../../scripts/infrastructure/backfill/lib/steps.mjs';
import { runVerification } from '../../../scripts/infrastructure/backfill/lib/verify.mjs';

const hasDatabase = !!process.env.DATABASE_URL;

async function applyAllMigrations(client) {
  const files = listMigrationFiles();
  for (const file of files) {
    await client.query(readFileSync(file.path, 'utf8'));
  }
}

async function applySeeds(client) {
  for (const file of listSeedFiles()) {
    await client.query(readFileSync(file, 'utf8'));
  }
}

async function runFullBackfill(client, runId) {
  return withTransaction(client, async (tx) => {
    const steps = {};
    steps.memberships = await backfillMemberships(tx, runId);
    steps.branches = await backfillBranches(tx, runId);
    steps.warehouses = await backfillWarehouses(tx, runId);
    steps.shop_settings = await backfillShopSettings(tx, runId);
    steps.subscriptions = await backfillSubscriptions(tx, runId);
    const verification = await runVerification(tx);
    return { steps, verification };
  });
}

describe('Milestone C1 backfill integration', { skip: !hasDatabase }, () => {
  let client;

  before(async () => {
    client = await createClient(resolveEnvironment('development'));

    const bootstrap = readFileSync(
      join(getProjectRoot(), 'supabase', 'tests', 'bootstrap', 'v1_minimal.sql'),
      'utf8'
    );
    await client.query(bootstrap);
    await applyAllMigrations(client);
    await applySeeds(client);
  });

  after(async () => {
    if (client) await client.end();
  });

  it('empty database backfill produces zero inserts', async () => {
    const runId = `c1-empty-${randomUUID().slice(0, 8)}`;
    const { steps } = await runFullBackfill(client, runId);

    assert.equal(steps.memberships.inserted, 0);
    assert.equal(steps.branches.inserted, 0);
    assert.equal(steps.warehouses.inserted, 0);
  });

  it('production snapshot fixture migrates all rows', async () => {
    const fixture = readFileSync(
      join(getProjectRoot(), 'supabase', 'tests', 'fixtures', 'v1_sample.sql'),
      'utf8'
    );
    await client.query(fixture);

    const runId = `c1-snapshot-${randomUUID().slice(0, 8)}`;
    const { steps, verification } = await runFullBackfill(client, runId);

    assert.equal(steps.memberships.inserted, 3);
    assert.equal(steps.branches.inserted, 3);
    assert.equal(steps.warehouses.inserted, 3);
    assert.equal(steps.subscriptions.inserted, 3);
    assert.ok(steps.shop_settings.inserted > 0);
    assert.equal(verification.passed, true);

    const orphanWarning = steps.memberships.warnings?.some((w) =>
      w.includes('no user_profiles')
    );
    assert.equal(orphanWarning, true);
  });

  it('re-run migration is idempotent (partial already applied)', async () => {
    const runId = `c1-rerun-${randomUUID().slice(0, 8)}`;
    const first = await runFullBackfill(client, runId);
    const second = await runFullBackfill(client, runId);

    assert.equal(first.verification.passed, true);
    assert.equal(second.verification.passed, true);
    assert.equal(second.steps.memberships.inserted, 0);
    assert.equal(second.steps.memberships.skipped, 3);
    assert.equal(second.steps.branches.skipped, 3);
    assert.equal(second.steps.warehouses.skipped, 3);
    assert.equal(second.steps.subscriptions.skipped, 3);
  });

  it('rollback removes backfill data', async () => {
    const rollback = readFileSync(
      join(getProjectRoot(), 'scripts', 'infrastructure', 'rollback-backfill.mjs'),
      'utf8'
    );
    assert.ok(rollback.includes('BACKFILL_BRANCH_CODE'));

    await client.query(`DELETE FROM public.subscriptions`);
    await client.query(`DELETE FROM public.shop_settings`);
    await client.query(`DELETE FROM public.warehouses`);
    await client.query(`DELETE FROM public.branches`);
    await client.query(`DELETE FROM public.memberships`);
    await client.query(`DELETE FROM public.audit_logs WHERE metadata->>'milestone' = 'C1'`);

    const counts = await client.query(`
      SELECT
        (SELECT count(*)::int FROM memberships) AS memberships,
        (SELECT count(*)::int FROM branches) AS branches,
        (SELECT count(*)::int FROM warehouses) AS warehouses
    `);
    assert.equal(counts.rows[0].memberships, 0);
    assert.equal(counts.rows[0].branches, 0);
    assert.equal(counts.rows[0].warehouses, 0);
  });

  it('FK constraints reject invalid membership', async () => {
    const role = await client.query(
      `SELECT id FROM public.system_roles WHERE slug = 'shop_owner' LIMIT 1`
    );
    await assert.rejects(
      () => client.query(
        `INSERT INTO public.memberships (user_id, shop_id, role_id)
         VALUES ($1, $2, $3)`,
        [
          '00000000-0000-0000-0000-000000000099',
          '00000000-0000-0000-0000-000000000099',
          role.rows[0].id,
        ]
      ),
      /violates foreign key constraint/
    );
  });
});

if (!hasDatabase) {
  console.log('Skipping Milestone C1 integration tests — DATABASE_URL not set');
}
