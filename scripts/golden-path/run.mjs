#!/usr/bin/env node
/**
 * RetailX V2 Sprint E2 — Golden Path Validation Runner
 *
 * Usage:
 *   npm run golden-path
 *   npm run golden-path -- --negative-only
 *   npm run golden-path -- --golden-only
 */

import { join } from 'node:path';
import { getProjectRoot } from '../infrastructure/lib/helpers.mjs';
import { loadEnv, requireSupabaseEnv, checkSupabaseConnectivity } from './lib/env.mjs';
import { runGoldenPath } from './lib/golden-path.mjs';
import { runNegativeTests } from './lib/negative.mjs';
import { buildReport, writeReports, printSummary } from './lib/report.mjs';

const args = process.argv.slice(2);
const goldenOnly = args.includes('--golden-only');
const negativeOnly = args.includes('--negative-only');

async function main() {
  const start = Date.now();
  const env = loadEnv();

  try {
    requireSupabaseEnv(env);
  } catch (err) {
    console.error(err.message);
    console.error('\nGolden path requires .env.local with Supabase credentials.');
    process.exit(1);
  }

  const reachable = await checkSupabaseConnectivity(env);
  if (!reachable) {
    console.warn(`\nWarning: Supabase at ${env.supabaseUrl} is not reachable.`);
    console.warn('Live golden path will fail — check network or project URL.\n');
  }

  const runId = `golden-path-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;

  let goldenResult = {
    overallResult: 'skip',
    steps: [],
    performance: {},
    context: {},
    validations: { passed: 0, total: 0, allPassed: true, items: {} },
    knownIssues: [],
  };

  let negativeTests = [];

  if (!negativeOnly) {
    console.log('Running golden path workflow...\n');
    goldenResult = await runGoldenPath(env);
    if (goldenResult.overallResult === 'fail') {
      console.error('Golden path failed — see report for details.');
    }
  }

  if (!goldenOnly) {
    console.log('Running negative tests...\n');
    negativeTests = await runNegativeTests(env);
  }

  const report = buildReport({
    runId,
    goldenPath: goldenResult.steps,
    negativeTests,
    performance: goldenResult.performance ?? {},
    validations: goldenResult.validations ?? { passed: 0, total: 0, items: {} },
    context: goldenResult.context ?? {},
    knownIssues: goldenResult.knownIssues ?? [],
    overallResult: computeOverall(goldenResult, negativeTests, goldenOnly, negativeOnly),
    durationMs: Date.now() - start,
  });

  const outputDir = join(getProjectRoot(), 'reports', 'golden-path');
  const written = writeReports(report, outputDir);
  printSummary(report);

  console.log('Reports written:');
  for (const f of written) {
    console.log(`  ${f}`);
  }
  console.log(`  ${join(outputDir, 'latest.json')}`);
  console.log(`  ${join(outputDir, 'latest.md')}`);
  console.log(`  ${join(outputDir, 'latest.html')}`);

  const exitCode =
    report.overallResult === 'fail' ? 1 : report.overallResult === 'partial' ? 0 : 0;
  process.exit(exitCode);
}

function computeOverall(goldenResult, negativeTests, goldenOnly, negativeOnly) {
  if (goldenOnly) return goldenResult.overallResult ?? 'fail';
  if (negativeOnly) {
    const failed = negativeTests.filter((t) => t.result === 'fail').length;
    const skipped = negativeTests.filter((t) => t.result === 'skip').length;
    if (skipped === negativeTests.length) return 'skip';
    return failed === 0 ? 'pass' : 'fail';
  }

  const goldenFail = goldenResult.steps?.some((s) => s.result === 'fail');
  const negFail = negativeTests.some((t) => t.result === 'fail');
  const negSkip = negativeTests.every((t) => t.result === 'skip');
  const partial = !goldenFail && !goldenResult.validations?.allPassed;

  if (negSkip && goldenResult.overallResult === 'fail') return 'skip';
  if (goldenFail || negFail) return 'fail';
  if (partial || goldenResult.overallResult === 'partial') return 'partial';
  return 'pass';
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
