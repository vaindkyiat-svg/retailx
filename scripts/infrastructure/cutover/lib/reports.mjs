/**
 * RetailX V2 Milestone C3 — Cutover, performance, and risk reports
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export function buildRiskReport(cutoverReport) {
  const risks = [];
  const mitigations = [];

  const score = cutoverReport.healthScore?.overall ?? 0;

  if (score < 100) {
    risks.push({ level: 'medium', item: 'Health score below 100%', detail: `${score}%` });
    mitigations.push('Run npm run db:repair -- all before production cutover');
  }

  if (cutoverReport.steps?.simulations?.failed > 0) {
    risks.push({ level: 'high', item: 'Simulation failures', detail: `${cutoverReport.steps.simulations.failed} failed` });
    mitigations.push('Review simulation errors in cutover report');
  }

  const flags = cutoverReport.steps?.simulations?.simulations?.find((s) => s.name === 'feature_flags_read');
  if (flags) {
    risks.push({ level: 'low', item: 'V2 feature flags still disabled', detail: 'Expected for pre-cutover' });
  }

  if (!cutoverReport.steps?.rollback_validation?.migrations?.ready) {
    risks.push({ level: 'high', item: 'Incomplete rollback coverage' });
    mitigations.push('Add missing rollback scripts before production');
  }

  const orphanShops = cutoverReport.databaseStats?.rowCounts?.shops >
    cutoverReport.databaseStats?.rowCounts?.memberships;
  if (orphanShops) {
    risks.push({ level: 'medium', item: 'Shops without memberships', detail: 'Orphan shops may exist' });
    mitigations.push('Run backfill or repair-memberships');
  }

  const perf = cutoverReport.performance;
  const slowPhases = perf?.phases?.filter((p) => p.durationMs > 5000) ?? [];
  if (slowPhases.length > 0) {
    risks.push({ level: 'low', item: 'Slow pipeline phases', detail: slowPhases.map((p) => p.name).join(', ') });
  }

  const high = risks.filter((r) => r.level === 'high').length;
  const medium = risks.filter((r) => r.level === 'medium').length;

  return {
    overallRisk: high > 0 ? 'high' : medium > 0 ? 'medium' : 'low',
    risks,
    mitigations,
    cutoverReady: high === 0 && score >= 99.5,
    authMigrationReady: score >= 99.5 && cutoverReport.steps?.verification?.passed,
  };
}

export function buildPerformanceReport(cutoverReport) {
  const perf = cutoverReport.performance ?? {};
  const sims = cutoverReport.steps?.simulations?.simulations ?? [];

  return {
    totalDurationMs: cutoverReport.totalDurationMs,
    pipelinePhases: perf.phases ?? [],
    memory: perf.memory,
    queryPerformance: sims.map((s) => ({
      name: s.name,
      durationMs: s.durationMs,
      rowCount: s.rowCount,
    })),
    slowestQuery: sims.reduce((a, b) => (a.durationMs > b.durationMs ? a : b), { durationMs: 0, name: 'none' }),
    databaseLoad: cutoverReport.databaseStats,
    thresholds: {
      pipelineMaxMs: 120000,
      queryMaxMs: 1000,
      memoryMaxMb: 512,
    },
    withinThresholds: {
      pipeline: (cutoverReport.totalDurationMs ?? 0) < 120000,
      memory: (perf.memory?.peakHeapMb ?? 0) < 512,
      queries: sims.every((s) => s.durationMs < 1000),
    },
  };
}

export function toCutoverMarkdown(cutover, performance, risk) {
  const lines = [
    '# Staging Cutover Simulation Report',
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    `| Run ID | \`${cutover.runId}\` |`,
    `| Status | **${cutover.status}** |`,
    `| Health Score | **${cutover.healthScore?.overall ?? '—'}%** |`,
    `| Duration | ${cutover.totalDurationMs}ms |`,
    `| Mode | Simulation only |`,
    `| Cutover Ready | ${risk.cutoverReady ? 'YES' : 'NO'} |`,
    `| Auth Migration Ready | ${risk.authMigrationReady ? 'YES' : 'NO'} |`,
    '',
    '## Pipeline Steps',
    '',
    '| Step | Duration | Details |',
    '|------|----------|---------|',
  ];

  for (const phase of performance.pipelinePhases) {
    lines.push(`| ${phase.name} | ${phase.durationMs}ms | mem Δ${phase.memoryDeltaMb ?? 0}MB |`);
  }

  lines.push('', '## Health Score Breakdown', '');
  if (cutover.healthScore?.categories) {
    for (const [cat, data] of Object.entries(cutover.healthScore.categories)) {
      lines.push(`- **${cat}**: ${data.score}% (${data.passed}/${data.total})`);
    }
  }

  lines.push('', '## Simulations', '');
  for (const sim of cutover.steps?.simulations?.simulations ?? []) {
    const icon = sim.passed ? '✓' : '✗';
    lines.push(`- ${icon} ${sim.name}: ${sim.durationMs}ms — ${sim.description ?? ''}`);
  }

  lines.push('', '## Risk Assessment', '');
  lines.push(`Overall risk: **${risk.overallRisk}**`, '');
  for (const r of risk.risks) {
    lines.push(`- [${r.level.toUpperCase()}] ${r.item}${r.detail ? `: ${r.detail}` : ''}`);
  }

  if (risk.mitigations.length > 0) {
    lines.push('', '### Mitigations', '');
    risk.mitigations.forEach((m) => lines.push(`- ${m}`));
  }

  lines.push('', '## Rollback Validation', '');
  const rb = cutover.steps?.rollback_validation?.migrations;
  lines.push(`Rollback readiness: ${rb?.score ?? 0}% (${rb?.ready ? 'READY' : 'GAPS'})`);

  if (cutover.warnings?.length) {
    lines.push('', '## Warnings', '');
    cutover.warnings.forEach((w) => lines.push(`- ⚠ ${w}`));
  }

  if (cutover.errors?.length) {
    lines.push('', '## Errors', '');
    cutover.errors.forEach((e) => lines.push(`- ✗ ${e}`));
  }

  return lines.join('\n');
}

export function writeCutoverReports(cutoverReport, outputDir) {
  mkdirSync(outputDir, { recursive: true });
  const performance = buildPerformanceReport(cutoverReport);
  const risk = buildRiskReport(cutoverReport);
  const base = join(outputDir, cutoverReport.runId);

  const bundle = {
    cutover: cutoverReport,
    performance,
    risk,
    rollbackValidation: cutoverReport.steps?.rollback_validation,
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(`${base}-cutover.json`, JSON.stringify(bundle, null, 2));
  writeFileSync(`${base}-cutover.md`, toCutoverMarkdown(cutoverReport, performance, risk));
  writeFileSync(`${base}-performance.json`, JSON.stringify(performance, null, 2));
  writeFileSync(`${base}-risk.json`, JSON.stringify(risk, null, 2));

  return {
    files: [
      `${base}-cutover.json`,
      `${base}-cutover.md`,
      `${base}-performance.json`,
      `${base}-risk.json`,
    ],
    performance,
    risk,
  };
}

export function printCutoverSummary(cutover, performance, risk) {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  RetailX V2 — Staging Cutover Simulation');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Run ID:          ${cutover.runId}`);
  console.log(`Status:          ${cutover.status}`);
  console.log(`Health Score:    ${cutover.healthScore?.overall ?? '—'}%`);
  console.log(`Duration:        ${cutover.totalDurationMs}ms`);
  console.log(`Simulations:     ${cutover.steps?.simulations?.passed ?? 0}/${cutover.steps?.simulations?.total ?? 0} passed`);
  console.log(`Rollback Ready:  ${cutover.steps?.rollback_validation?.migrations?.ready ? 'YES' : 'NO'} (${cutover.steps?.rollback_validation?.migrations?.score ?? 0}%)`);
  console.log(`Cutover Ready:   ${risk.cutoverReady ? 'YES' : 'NO'}`);
  console.log(`Risk Level:      ${risk.overallRisk.toUpperCase()}`);
  console.log(`Peak Memory:     ${performance.memory?.peakHeapMb ?? '—'}MB`);
  console.log('───────────────────────────────────────────────────');

  if (cutover.warnings?.length) {
    console.log('Warnings:');
    cutover.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  }
  if (cutover.errors?.length) {
    console.log('Errors:');
    cutover.errors.forEach((e) => console.log(`  ✗ ${e}`));
  }

  console.log('═══════════════════════════════════════════════════\n');
}
