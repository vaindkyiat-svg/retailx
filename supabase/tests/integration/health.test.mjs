/**
 * RetailX V2 Milestone C2 — Health engine integration tests
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
import { runHealthChecks, runArchitectureChecks } from '../../../scripts/infrastructure/health/lib/checks.mjs';
import { calculateHealthScore } from '../../../scripts/infrastructure/health/lib/score.mjs';
import { runRepair } from '../../../scripts/infrastructure/health/lib/repair.mjs';
import {
  backfillMemberships,
  backfillBranches,
  backfillWarehouses,
  backfillShopSettings,
  backfillSubscriptions,
} from '../../../scripts/infrastructure/backfill/lib/steps.mjs';

const hasDatabase = !!process.env.DATABASE_URL;

async function setupDatabase(client) {
  const root = getProjectRoot();
  await client.query(readFileSync(join(root, 'supabase/tests/bootstrap/v1_minimal.sql'), 'utf8'));
  for (const f of listMigrationFiles()) {
    await client.query(readFileSync(f.path, 'utf8'));
  }
  for (const f of listSeedFiles()) {
    await client.query(readFileSync(f, 'utf8'));
  }
}

async function runBackfill(client, runId) {
  await withTransaction(client, async (tx) => {
    await backfillMemberships(tx, runId);
    await backfillBranches(tx, runId);
    await backfillWarehouses(tx, runId);
    await backfillShopSettings(tx, runId);
    await backfillSubscriptions(tx, runId);
  });
}

describe('Milestone C2 health integration', { skip: !hasDatabase }, () => {
  let client;

  before(async () => {
    client = await createClient(resolveEnvironment('development'));
    await setupDatabase(client);
  });

  after(async () => {
    if (client) await client.end();
  });

  it('healthy database scores 100%', async () => {
    const fixture = readFileSync(
      join(getProjectRoot(), 'supabase/tests/fixtures/v1_sample.sql'),
      'utf8'
    );
    await client.query(fixture);
    await runBackfill(client, `c1-${randomUUID().slice(0, 8)}`);

    const { checks } = await runHealthChecks(client, { full: true });
    const arch = await runArchitectureChecks(client);
    const score = calculateHealthScore([...checks, ...arch]);

    assert.equal(score.status, 'healthy');
    assert.equal(score.overall, 100);
  });

  it('corrupted database detects issues', async () => {
    const corrupt = readFileSync(
      join(getProjectRoot(), 'supabase/tests/fixtures/v2_corrupted.sql'),
      'utf8'
    );
    await client.query(corrupt);

    const { checks } = await runHealthChecks(client, { full: true });
    const failed = checks.filter((c) => !c.passed);
    assert.ok(failed.length >= 3, `Expected >= 3 failures, got ${failed.length}`);
    assert.ok(failed.some((c) => c.name.includes('default_branch') || c.name.includes('multiple_default')));
  });

  it('repair dry-run does not modify data', async () => {
    const before = await client.query(`SELECT count(*)::int AS c FROM public.branches`);
    const report = await runRepair(client, 'branches', `dry-${randomUUID().slice(0, 8)}`, true);
    const after = await client.query(`SELECT count(*)::int AS c FROM public.branches`);
    assert.equal(before.rows[0].c, after.rows[0].c);
    assert.equal(report.dryRun, true);
  });

  it('repair defaults fixes duplicate default branches', async () => {
    const report = await withTransaction(client, async (tx) => {
      return runRepair(tx, 'defaults', `fix-${randomUUID().slice(0, 8)}`, false);
    });

    assert.ok(report.steps.defaults.inserted >= 0);

    const dup = await client.query(
      `SELECT count(*)::int AS count FROM (
         SELECT shop_id FROM public.branches
         WHERE is_default = true AND deleted_at IS NULL
         GROUP BY shop_id HAVING count(*) > 1
       ) x`
    );
    assert.equal(dup.rows[0].count, 0);
  });

  it('repair all is idempotent on second run', async () => {
    const runId = `idem-${randomUUID().slice(0, 8)}`;
    const first = await withTransaction(client, async (tx) => runRepair(tx, 'all', runId, false));
    const second = await withTransaction(client, async (tx) => runRepair(tx, 'all', runId, false));

    assert.equal(second.summary.inserted, 0);
    assert.ok(second.summary.skipped >= 0);
  });

  it('quick health mode skips operations checks', async () => {
    const full = await runHealthChecks(client, { full: true });
    const quick = await runHealthChecks(client, { full: false });
    assert.ok(full.checks.length > quick.checks.length);
  });
});

if (!hasDatabase) {
  console.log('Skipping Milestone C2 integration tests — DATABASE_URL not set');
}
