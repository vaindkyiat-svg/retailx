#!/usr/bin/env node
/**
 * RetailX V2 Milestone C1 — V1→V2 data backfill
 *
 * Usage:
 *   node scripts/infrastructure/backfill.mjs [--env development] [--dry-run] [--skip-verify]
 */

import { randomUUID } from 'node:crypto';
import {
  createClient,
  resolveEnvironment,
  withTransaction,
  log,
  confirmProduction,
  loadEnvironments,
} from './lib/helpers.mjs';
import {
  backfillMemberships,
  backfillBranches,
  backfillWarehouses,
  backfillShopSettings,
  backfillSubscriptions,
  recordBackfillRun,
} from './backfill/lib/steps.mjs';
import { runVerification } from './backfill/lib/verify.mjs';
import { createReport, finalizeReport, printReport } from './backfill/lib/report.mjs';

const args = process.argv.slice(2);
const envFlag = args.find((a) => a.startsWith('--env='))?.split('=')[1]
  ?? args[args.indexOf('--env') + 1];
const dryRun = args.includes('--dry-run');
const skipVerify = args.includes('--skip-verify');

async function ensurePrerequisites(client) {
  const tables = ['memberships', 'branches', 'warehouses', 'shop_settings', 'subscriptions', 'system_roles', 'plans'];
  for (const table of tables) {
    const r = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      )`,
      [table]
    );
    if (!r.rows[0].exists) {
      throw new Error(`Prerequisite table missing: ${table}. Run npm run db:migrate first.`);
    }
  }

  const roles = await client.query(`SELECT count(*)::int AS c FROM public.system_roles`);
  if (roles.rows[0].c < 1) {
    throw new Error('system_roles empty. Run npm run db:seed first.');
  }

  const plans = await client.query(`SELECT count(*)::int AS c FROM public.plans`);
  if (plans.rows[0].c < 1) {
    throw new Error('plans empty. Run npm run db:seed first.');
  }
}

async function main() {
  const env = resolveEnvironment(envFlag);
  const config = loadEnvironments()[env];

  if (config.requireConfirmation) {
    confirmProduction(`About to run Milestone C1 backfill on ${env}.`);
  }

  const runId = `c1-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const report = createReport(runId);

  log('info', 'Starting Milestone C1 backfill', { runId, environment: env, dryRun });

  const client = await createClient(env);

  try {
    await ensurePrerequisites(client);

    if (dryRun) {
      const shops = await client.query(`SELECT count(*)::int AS c FROM public.shops`);
      const profiles = await client.query(`SELECT count(*)::int AS c FROM public.user_profiles`);
      report.steps.preflight = {
        name: 'preflight',
        details: { shops: shops.rows[0].c, userProfiles: profiles.rows[0].c },
      };
      report.status = 'dry_run';
      finalizeReport(report, 'dry_run');
      printReport(report);
      return;
    }

    await client.query(
      `INSERT INTO public.backfill_runs (run_id, milestone, environment, status)
       VALUES ($1, 'C1', $2, 'running')
       ON CONFLICT (run_id) DO NOTHING`,
      [runId, env]
    ).catch(() => {
      log('warn', 'backfill_runs table not found — run db:migrate for audit tracking');
    });

    await withTransaction(client, async (tx) => {
      report.steps.memberships = await backfillMemberships(tx, runId);
      report.steps.branches = await backfillBranches(tx, runId);
      report.steps.warehouses = await backfillWarehouses(tx, runId);
      report.steps.shop_settings = await backfillShopSettings(tx, runId);
      report.steps.subscriptions = await backfillSubscriptions(tx, runId);

      if (!skipVerify) {
        report.verification = await runVerification(tx);
        if (!report.verification.passed) {
          const failed = report.verification.checks.filter((c) => !c.passed).map((c) => c.name);
          throw new Error(`Verification failed: ${failed.join(', ')}`);
        }
      }
    });

    finalizeReport(report, 'completed');
    await recordBackfillRun(client, report, env);
    printReport(report);
    log('info', 'Milestone C1 backfill completed', { runId, inserted: report.summary.rowsInserted });
  } catch (err) {
    finalizeReport(report, 'failed');
    report.errors.push(err.message ?? String(err));

    try {
      await recordBackfillRun(client, report, env);
    } catch {
      // backfill_runs table may not exist yet
    }

    printReport(report);
    log('error', 'Milestone C1 backfill failed', { runId, error: err.message });
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  log('error', err.message ?? String(err));
  process.exit(1);
});
