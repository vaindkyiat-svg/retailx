#!/usr/bin/env node
/**
 * RetailX V2 Milestone C2 — Validation & Health Engine
 *
 * Usage:
 *   npm run db:health
 *   npm run db:health -- --format json,markdown,html --output reports/health
 *   npm run db:health -- --trigger ci --full
 */

import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import {
  createClient,
  resolveEnvironment,
  getProjectRoot,
  log,
} from './lib/helpers.mjs';
import { runHealthChecks, runArchitectureChecks } from './health/lib/checks.mjs';
import { calculateHealthScore, collectRepairSuggestions } from './health/lib/score.mjs';
import {
  buildHealthReport,
  printHealthSummary,
  writeReports,
} from './health/lib/reports.mjs';
import { saveHealthRun, getPreviousHealthRun } from './health/lib/history.mjs';

const args = process.argv.slice(2);

function getArg(name) {
  const eq = args.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.split('=')[1];
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const envFlag = getArg('env');
const trigger = getArg('trigger') ?? 'manual';
const formats = (getArg('format') ?? 'markdown').split(',');
const outputDir = getArg('output') ?? join(getProjectRoot(), 'reports', 'health');
const full = !args.includes('--quick');

async function main() {
  const env = resolveEnvironment(envFlag);
  const runId = `health-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const start = Date.now();

  log('info', 'Starting health engine', { runId, environment: env, trigger, full });

  const client = await createClient(env);

  try {
    const { checks, durationMs: checkMs } = await runHealthChecks(client, { full });
    const architecture = await runArchitectureChecks(client);
    const allChecks = [...checks, ...architecture];
    const healthScore = calculateHealthScore(allChecks);
    const repairSuggestions = collectRepairSuggestions(allChecks);
    const previous = await getPreviousHealthRun(client, env);

    const report = buildHealthReport({
      runId,
      environment: env,
      trigger,
      health: healthScore,
      checks,
      architecture,
      repairSuggestions,
      history: previous ? { previous } : null,
      durationMs: Date.now() - start,
    });

    await saveHealthRun(client, report);

    const written = writeReports(report, outputDir, formats);
    printHealthSummary(report);

    if (written.length > 0) {
      log('info', 'Reports written', { files: written });
    }

    const exitCode = healthScore.status === 'unhealthy' ? 1 : 0;
    process.exit(exitCode);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  log('error', err.message ?? String(err));
  process.exit(1);
});
