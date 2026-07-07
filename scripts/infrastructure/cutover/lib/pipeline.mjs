/**
 * RetailX V2 Milestone C3 — Cutover pipeline orchestration
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  getProjectRoot,
  listMigrationFiles,
  listSeedFiles,
  withTransaction,
} from '../../lib/helpers.mjs';
import {
  backfillMemberships,
  backfillBranches,
  backfillWarehouses,
  backfillShopSettings,
  backfillSubscriptions,
} from '../../backfill/lib/steps.mjs';
import { runHealthChecks, runArchitectureChecks } from '../../health/lib/checks.mjs';
import { calculateHealthScore, collectRepairSuggestions } from '../../health/lib/score.mjs';
import { runRepair } from '../../health/lib/repair.mjs';
import { createMetricsCollector, collectDatabaseStats } from './metrics.mjs';
import { runSimulations } from './simulations.mjs';
import { validateRollbackReadiness, validateBackfillRollbackScripts } from './rollback-validation.mjs';

async function applyMigrations(client, metrics) {
  const ctx = metrics.startPhase('migrations');
  const files = listMigrationFiles();
  let applied = 0;
  let skipped = 0;

  for (const file of files) {
    try {
      const existing = await client.query(
        `SELECT 1 FROM public.migration_history
         WHERE version = $1 AND status = 'applied' LIMIT 1`,
        [file.version]
      );
      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }
    } catch {
      // migration_history may not exist on first run
    }

    await client.query(readFileSync(file.path, 'utf8'));

    try {
      await client.query(
        `INSERT INTO public.migration_history (version, name, checksum, status, environment, applied_by)
         VALUES ($1, $2, $3, 'applied', 'staging', 'cutover-simulation')
         ON CONFLICT DO NOTHING`,
        [file.version, file.name, file.checksum]
      );
    } catch {
      // optional tracking
    }
    applied++;
  }

  return metrics.endPhase(ctx, { applied, skipped, total: files.length });
}

async function applySeeds(client, metrics) {
  const ctx = metrics.startPhase('seeds');
  let count = 0;
  for (const file of listSeedFiles()) {
    await client.query(readFileSync(file, 'utf8'));
    count++;
  }
  return metrics.endPhase(ctx, { seedFiles: count });
}

async function runBackfill(client, metrics, runId) {
  const ctx = metrics.startPhase('backfill');
  const steps = {};

  await withTransaction(client, async (tx) => {
    steps.memberships = await backfillMemberships(tx, runId);
    steps.branches = await backfillBranches(tx, runId);
    steps.warehouses = await backfillWarehouses(tx, runId);
    steps.shop_settings = await backfillShopSettings(tx, runId);
    steps.subscriptions = await backfillSubscriptions(tx, runId);
  });

  const inserted = Object.values(steps).reduce((s, st) => s + (st.inserted ?? 0), 0);
  return metrics.endPhase(ctx, { inserted, steps });
}

async function runHealth(client, metrics) {
  const ctx = metrics.startPhase('health_engine');
  const { checks } = await runHealthChecks(client, { full: true });
  const architecture = await runArchitectureChecks(client);
  const allChecks = [...checks, ...architecture];
  const healthScore = calculateHealthScore(allChecks);
  const repairSuggestions = collectRepairSuggestions(allChecks);

  return metrics.endPhase(ctx, {
    healthScore,
    checks: allChecks,
    repairSuggestions,
    passed: healthScore.status === 'healthy',
  });
}

async function runRepairIfNeeded(client, metrics, healthResult, runId, dryRun) {
  const ctx = metrics.startPhase('repair_engine');
  const score = healthResult.healthScore.overall;

  if (score >= 99.5) {
    return metrics.endPhase(ctx, { skipped: true, reason: 'Health score >= 99.5%', score });
  }

  const repairReport = dryRun
    ? await runRepair(client, 'all', runId, true)
    : await withTransaction(client, (tx) => runRepair(tx, 'all', runId, false));

  return metrics.endPhase(ctx, {
    dryRun,
    scoreBefore: score,
    repairReport,
  });
}

async function runVerification(client, metrics) {
  const ctx = metrics.startPhase('verification');
  const { checks } = await runHealthChecks(client, { full: true });
  const architecture = await runArchitectureChecks(client);
  const healthScore = calculateHealthScore([...checks, ...architecture]);

  return metrics.endPhase(ctx, {
    passed: healthScore.status === 'healthy',
    healthScore,
  });
}

async function loadSnapshot(client, metrics, useFixture) {
  if (!useFixture) {
    return { loaded: false, reason: 'Using existing staging data' };
  }

  const ctx = metrics.startPhase('load_snapshot');
  const root = getProjectRoot();
  const fixtures = [
    'supabase/tests/bootstrap/v1_minimal.sql',
    'supabase/tests/fixtures/v1_sample.sql',
    'supabase/tests/fixtures/staging_v1_business.sql',
    'supabase/tests/fixtures/staging_snapshot.sql',
  ];

  for (const f of fixtures) {
    await client.query(readFileSync(join(root, f), 'utf8'));
  }

  return metrics.endPhase(ctx, { loaded: true, fixtures: fixtures.length });
}

export async function runCutoverPipeline(client, options = {}) {
  const {
    useFixture = false,
    repairDryRun = true,
    autoRepair = true,
    environment = 'staging',
  } = options;

  const runId = `cutover-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const metrics = createMetricsCollector();
  const errors = [];
  const warnings = [];
  const pipelineStart = Date.now();

  const report = {
    runId,
    milestone: 'C3',
    environment,
    mode: 'simulation',
    startedAt: new Date().toISOString(),
    steps: {},
  };

  try {
    report.steps.snapshot = await loadSnapshot(client, metrics, useFixture);

    report.steps.migrations = await applyMigrations(client, metrics);
    report.steps.seeds = await applySeeds(client, metrics);
    report.steps.backfill = await runBackfill(client, metrics, runId);

    const healthResult = await runHealth(client, metrics);
    report.steps.health = healthResult;
    report.healthScore = healthResult.healthScore;

    if (autoRepair && healthResult.healthScore.overall < 99.5) {
      report.steps.repair = await runRepairIfNeeded(client, metrics, healthResult, runId, repairDryRun);
      if (!repairDryRun) {
        const reHealth = await runHealth(client, metrics);
        report.steps.health_post_repair = reHealth;
        report.healthScore = reHealth.healthScore;
      }
    }

    report.steps.verification = await runVerification(client, metrics);
    report.steps.simulations = await runSimulations(client, metrics);

    if (!report.steps.simulations.allPassed) {
      warnings.push(`${report.steps.simulations.failed} simulation(s) failed`);
    }

    report.steps.rollback_validation = {
      migrations: validateRollbackReadiness(),
      scripts: await validateBackfillRollbackScripts(),
    };

    report.databaseStats = await collectDatabaseStats(client);
    report.performance = metrics.getReport();
    report.completedAt = new Date().toISOString();
    report.totalDurationMs = Date.now() - pipelineStart;
    report.status = deriveStatus(report);

    if (report.healthScore?.overall < 90) errors.push('Health score below 90%');
    if (!report.steps.verification?.passed) errors.push('Verification failed');
    if (!report.steps.rollback_validation?.migrations?.ready) warnings.push('Rollback not fully ready');

    report.errors = errors;
    report.warnings = warnings;

    return report;
  } catch (err) {
    report.status = 'failed';
    report.errors = [...errors, err.message];
    report.completedAt = new Date().toISOString();
    report.totalDurationMs = Date.now() - pipelineStart;
    report.performance = metrics.getReport();
    throw Object.assign(err, { cutoverReport: report });
  }
}

function deriveStatus(report) {
  if (report.errors?.length > 0) return 'failed';
  if (report.healthScore?.overall >= 99.5 && report.steps.verification?.passed) return 'passed';
  if (report.healthScore?.overall >= 90) return 'passed_with_warnings';
  return 'failed';
}
