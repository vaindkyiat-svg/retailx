#!/usr/bin/env node
/**
 * RetailX V2 Milestone C3 — Staging Cutover Simulation
 *
 * Usage:
 *   npm run db:cutover                              # Use existing DATABASE_URL
 *   npm run db:cutover -- --fixture                 # Load representative snapshot
 *   npm run db:cutover -- --env staging --repair    # Auto-repair if health < 99.5%
 */

import { join } from 'node:path';
import {
  createClient,
  resolveEnvironment,
  getProjectRoot,
  log,
} from './lib/helpers.mjs';
import { runCutoverPipeline } from './cutover/lib/pipeline.mjs';
import {
  writeCutoverReports,
  printCutoverSummary,
} from './cutover/lib/reports.mjs';

const args = process.argv.slice(2);

function getArg(name) {
  const eq = args.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.split('=')[1];
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const useFixture = args.includes('--fixture');
const autoRepair = args.includes('--repair');
const repairDryRun = !args.includes('--repair-apply');

async function saveCutoverRun(client, report) {
  try {
    const exists = await client.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'cutover_runs'
      )`
    );
    if (!exists.rows[0].exists) return;

    await client.query(
      `INSERT INTO public.cutover_runs
         (run_id, environment, status, health_score, total_duration_ms, cutover_report, performance_report, risk_report, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (run_id) DO UPDATE SET
         status = EXCLUDED.status,
         health_score = EXCLUDED.health_score,
         total_duration_ms = EXCLUDED.total_duration_ms,
         cutover_report = EXCLUDED.cutover_report,
         performance_report = EXCLUDED.performance_report,
         risk_report = EXCLUDED.risk_report,
         completed_at = EXCLUDED.completed_at`,
      [
        report.runId,
        report.environment,
        report.status === 'failed' ? 'failed' : 'passed',
        report.healthScore?.overall ?? null,
        report.totalDurationMs,
        JSON.stringify(report),
        JSON.stringify(report.performance),
        JSON.stringify(report.risk ?? {}),
        report.completedAt,
      ]
    );
  } catch {
    // cutover_runs optional before migration
  }
}

async function main() {
  const env = resolveEnvironment(getArg('env') ?? process.env.RETAILX_ENV ?? 'development');
  const outputDir = getArg('output') ?? join(getProjectRoot(), 'reports', 'cutover');

  log('info', 'Starting C3 staging cutover simulation', {
    environment: env,
    useFixture,
    autoRepair,
    repairDryRun,
    mode: 'simulation-only',
  });

  const client = await createClient(env);

  try {
    const report = await runCutoverPipeline(client, {
      useFixture,
      repairDryRun,
      autoRepair,
      environment: env,
    });

    const { performance, risk, files } = writeCutoverReports(report, outputDir);
    report.risk = risk;
    report.performance = performance;

    await saveCutoverRun(client, report);
    printCutoverSummary(report, performance, risk);

    log('info', 'Cutover simulation complete', {
      runId: report.runId,
      status: report.status,
      healthScore: report.healthScore?.overall,
      files,
    });

    process.exit(report.status === 'failed' ? 1 : 0);
  } catch (err) {
    if (err.cutoverReport) {
      const { performance, risk } = writeCutoverReports(err.cutoverReport, outputDir);
      printCutoverSummary(err.cutoverReport, performance, risk);
    }
    log('error', 'Cutover simulation failed', { error: err.message });
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  log('error', err.message ?? String(err));
  process.exit(1);
});
