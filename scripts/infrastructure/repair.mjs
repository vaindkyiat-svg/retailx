#!/usr/bin/env node
/**
 * RetailX V2 Milestone C2 — Safe repair engine
 *
 * Usage:
 *   npm run db:repair -- memberships
 *   npm run db:repair -- all --dry-run
 *   npm run db:repair -- defaults
 */

import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import {
  createClient,
  resolveEnvironment,
  withTransaction,
  getProjectRoot,
  log,
  loadEnvironments,
} from './lib/helpers.mjs';
import { runRepair, REPAIR_TARGETS } from './health/lib/repair.mjs';
import { toRepairMarkdown, writeReports } from './health/lib/reports.mjs';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const target = args.find((a) => !a.startsWith('--') && REPAIR_TARGETS.includes(a))
  ?? args.find((a) => !a.startsWith('--'));

function getArg(name) {
  const eq = args.find((a) => a.startsWith(`--${name}=`));
  if (eq) return eq.split('=')[1];
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 ? args[idx + 1] : undefined;
}

async function main() {
  if (!target || !REPAIR_TARGETS.includes(target)) {
    console.error(`Usage: repair.mjs <target> [--dry-run] [--env env]`);
    console.error(`Targets: ${REPAIR_TARGETS.join(', ')}`);
    process.exit(1);
  }

  const env = resolveEnvironment(getArg('env'));
  const config = loadEnvironments()[env];

  if (env === 'production' && !dryRun) {
    log('error', 'Production repairs require --dry-run first, then explicit approval');
    process.exit(1);
  }

  const runId = `repair-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const client = await createClient(env);

  try {
    let report;

    if (dryRun) {
      report = await runRepair(client, target, runId, true);
    } else {
      await withTransaction(client, async (tx) => {
        report = await runRepair(tx, target, runId, false);
      });
    }

    report.dryRun = dryRun;

    const outputDir = join(getProjectRoot(), 'reports', 'repair');
    const path = join(outputDir, `${runId}.md`);
    const { writeFileSync, mkdirSync } = await import('node:fs');
    mkdirSync(outputDir, { recursive: true });
    writeFileSync(path, toRepairMarkdown(report));

    console.log('\n═══════════════════════════════════════════════════');
    console.log(`  Repair ${dryRun ? '(DRY RUN)' : 'COMPLETE'}: ${target}`);
    console.log('═══════════════════════════════════════════════════');
    console.log(`Run ID:     ${runId}`);
    console.log(`Processed:  ${report.summary.processed}`);
    console.log(`Repaired:   ${report.summary.inserted}`);
    console.log(`Skipped:    ${report.summary.skipped}`);
    console.log(`Report:     ${path}`);
    console.log('═══════════════════════════════════════════════════\n');

    log('info', 'Repair finished', { runId, target, dryRun, ...report.summary });
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  log('error', err.message ?? String(err));
  process.exit(1);
});
