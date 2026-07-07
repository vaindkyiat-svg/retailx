/**
 * RetailX V2 Milestone C1 — Backfill report builder
 */

export function createReport(runId) {
  return {
    runId,
    milestone: 'C1',
    startedAt: new Date().toISOString(),
    completedAt: null,
    durationMs: null,
    status: 'running',
    steps: {},
    verification: null,
    errors: [],
    warnings: [],
    summary: {
      rowsProcessed: 0,
      rowsInserted: 0,
      rowsSkipped: 0,
    },
  };
}

export function initStep(name) {
  return {
    name,
    startedAt: new Date().toISOString(),
    completedAt: null,
    durationMs: null,
    processed: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
    warnings: [],
    details: {},
  };
}

export function finalizeStep(step) {
  step.completedAt = new Date().toISOString();
  step.durationMs = new Date(step.completedAt) - new Date(step.startedAt);
  return step;
}

export function finalizeReport(report, status = 'completed') {
  report.completedAt = new Date().toISOString();
  report.durationMs = new Date(report.completedAt) - new Date(report.startedAt);
  report.status = status;

  for (const step of Object.values(report.steps)) {
    report.summary.rowsProcessed += step.processed ?? 0;
    report.summary.rowsInserted += step.inserted ?? 0;
    report.summary.rowsSkipped += step.skipped ?? 0;
    report.errors.push(...(step.errors ?? []));
    report.warnings.push(...(step.warnings ?? []));
  }

  return report;
}

export function printReport(report) {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  RetailX V2 — Milestone C1 Backfill Report');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Run ID:     ${report.runId}`);
  console.log(`Status:     ${report.status}`);
  console.log(`Duration:   ${report.durationMs ?? '—'}ms`);
  console.log(`Processed:  ${report.summary.rowsProcessed}`);
  console.log(`Inserted:   ${report.summary.rowsInserted}`);
  console.log(`Skipped:    ${report.summary.rowsSkipped}`);
  console.log('───────────────────────────────────────────────────');

  for (const step of Object.values(report.steps)) {
    console.log(`\n[${step.name}]`);
    console.log(`  processed=${step.processed} inserted=${step.inserted} skipped=${step.skipped}`);
    if (step.details && Object.keys(step.details).length > 0) {
      console.log(`  details: ${JSON.stringify(step.details)}`);
    }
    for (const w of step.warnings ?? []) console.log(`  ⚠ ${w}`);
    for (const e of step.errors ?? []) console.log(`  ✗ ${e}`);
  }

  if (report.verification) {
    console.log('\n[verification]');
    console.log(`  passed: ${report.verification.passed}`);
    console.log(`  checks: ${report.verification.passedCount}/${report.verification.totalCount}`);
    for (const check of report.verification.checks ?? []) {
      const icon = check.passed ? '✓' : '✗';
      console.log(`  ${icon} ${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
    }
  }

  if (report.warnings.length > 0) {
    console.log(`\nWarnings (${report.warnings.length}):`);
    report.warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  }

  if (report.errors.length > 0) {
    console.log(`\nErrors (${report.errors.length}):`);
    report.errors.forEach((e) => console.log(`  ✗ ${e}`));
  }

  console.log('\n═══════════════════════════════════════════════════\n');
}
