/**
 * RetailX V2 Sprint E2 — Golden Path report generators (JSON, Markdown, HTML)
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * @typedef {Object} GoldenPathStep
 * @property {string} step
 * @property {'pass'|'fail'|'skip'} result
 * @property {number} durationMs
 * @property {string[]} errors
 * @property {string[]} warnings
 * @property {string|null} recommendation
 */

/**
 * @typedef {GoldenPathStep} NegativeTestResult
 */

export function buildReport({
  runId,
  goldenPath,
  negativeTests,
  performance,
  validations,
  context,
  knownIssues,
  overallResult,
  durationMs,
}) {
  const goldenFailed = goldenPath.filter((s) => s.result === 'fail').length;
  const negativeFailed = negativeTests.filter((s) => s.result === 'fail').length;
  const negativeSkipped = negativeTests.filter((s) => s.result === 'skip').length;
  const warnings = [
    ...goldenPath.flatMap((s) => s.warnings),
    ...negativeTests.flatMap((s) => s.warnings),
    ...knownIssues,
  ];

  return {
    runId,
    sprint: 'E2',
    milestone: 'Golden Path Validation',
    generatedAt: new Date().toISOString(),
    overallResult,
    durationMs,
    summary: {
      goldenPathSteps: goldenPath.length,
      goldenPathPassed: goldenPath.length - goldenFailed,
      goldenPathFailed: goldenFailed,
      negativeTests: negativeTests.length,
      negativePassed: negativeTests.length - negativeFailed - negativeSkipped,
      negativeFailed,
      negativeSkipped,
      validationsPassed: validations.passed,
      validationsTotal: validations.total,
      warnings: warnings.length,
    },
    performance,
    goldenPath,
    negativeTests,
    validations: validations.items,
    context,
    knownIssues,
    recommendations: collectRecommendations(goldenPath, negativeTests, knownIssues),
  };
}

function collectRecommendations(steps, negatives, knownIssues) {
  const recs = new Set();
  for (const s of [...steps, ...negatives]) {
    if (s.recommendation) recs.add(s.recommendation);
  }
  for (const issue of knownIssues) {
    if (issue.includes('RLS')) recs.add('Apply order RLS fix: see RLS_FIX_INSTRUCTIONS.md');
    if (issue.includes('admin')) recs.add('Run: node create_admin.mjs');
  }
  return [...recs];
}

export function toMarkdown(report) {
  const statusIcon =
    report.overallResult === 'pass' ? '✅ PASS' : report.overallResult === 'partial' ? '⚠️ PARTIAL' : '❌ FAIL';

  const lines = [
    `# RetailX Golden Path Report — Sprint E2`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| Run ID | \`${report.runId}\` |`,
    `| Result | **${statusIcon}** |`,
    `| Duration | ${report.durationMs}ms |`,
    `| Golden Path | ${report.summary.goldenPathPassed}/${report.summary.goldenPathSteps} steps |`,
    `| Negative Tests | ${report.summary.negativePassed}/${report.summary.negativeTests} passed |`,
    `| Validations | ${report.summary.validationsPassed}/${report.summary.validationsTotal} |`,
    ``,
    `## Performance`,
    ``,
    `| Metric | Duration |`,
    `|--------|----------|`,
    `| Provisioning | ${fmtMs(report.performance.provisioningMs)} |`,
    `| Login | ${fmtMs(report.performance.loginMs)} |`,
    `| Dashboard load | ${fmtMs(report.performance.dashboardMs)} |`,
    `| Checkout | ${fmtMs(report.performance.checkoutMs)} |`,
    `| Report generation | ${fmtMs(report.performance.reportMs)} |`,
    `| **Total tracked** | **${fmtMs(report.performance.totalMs)}** |`,
    ``,
    `## Golden Path Steps`,
    ``,
    `| Step | Result | Duration | Errors | Warnings | Recommendation |`,
    `|------|--------|----------|--------|----------|----------------|`,
  ];

  for (const s of report.goldenPath) {
    lines.push(
      `| ${s.step} | ${s.result} | ${s.durationMs}ms | ${s.errors.join('; ') || '—'} | ${s.warnings.join('; ') || '—'} | ${s.recommendation ?? '—'} |`
    );
  }

  lines.push('', `## Negative Tests`, '');
  lines.push(`| Test | Result | Duration | Detail |`);
  lines.push(`|------|--------|----------|--------|`);

  for (const t of report.negativeTests) {
    const detail = t.errors.join('; ') || t.warnings.join('; ') || '—';
    lines.push(`| ${t.name} | ${t.result} | ${t.durationMs}ms | ${detail} |`);
  }

  lines.push('', `## Entity Validations`, '');
  for (const [key, val] of Object.entries(report.validations)) {
    lines.push(`- ${val.ok ? '✓' : '✗'} **${key}**${val.detail ? `: ${val.detail}` : ''}`);
  }

  if (report.knownIssues.length) {
    lines.push('', `## Known Issues`, '');
    for (const issue of report.knownIssues) {
      lines.push(`- ${issue}`);
    }
  }

  if (report.recommendations.length) {
    lines.push('', `## Recommendations`, '');
    for (const r of report.recommendations) {
      lines.push(`- ${r}`);
    }
  }

  return lines.join('\n');
}

export function toHtml(report) {
  const statusColor =
    report.overallResult === 'pass' ? '#16a34a' : report.overallResult === 'partial' ? '#ca8a04' : '#dc2626';

  const stepRows = report.goldenPath
    .map(
      (s) =>
        `<tr><td>${esc(s.step)}</td><td class="${s.result}">${s.result}</td><td>${s.durationMs}ms</td><td>${esc(s.errors.join('; ') || '—')}</td><td>${esc(s.warnings.join('; ') || '—')}</td><td>${esc(s.recommendation ?? '—')}</td></tr>`
    )
    .join('\n');

  const negRows = report.negativeTests
    .map(
      (t) =>
        `<tr><td>${esc(t.name)}</td><td class="${t.result}">${t.result}</td><td>${t.durationMs}ms</td><td>${esc(t.errors.concat(t.warnings).join('; ') || '—')}</td></tr>`
    )
    .join('\n');

  const valItems = Object.entries(report.validations)
    .map(([k, v]) => `<li class="${v.ok ? 'pass' : 'fail'}">${v.ok ? '✓' : '✗'} ${esc(k)}${v.detail ? `: ${esc(v.detail)}` : ''}</li>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Golden Path Report — ${esc(report.runId)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1100px; margin: 2rem auto; padding: 0 1rem; color: #111; }
    h1 { color: ${statusColor}; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: 0.9rem; }
    th, td { border: 1px solid #e5e7eb; padding: 0.5rem 0.65rem; text-align: left; vertical-align: top; }
    th { background: #f9fafb; }
    .pass { color: #16a34a; font-weight: 600; }
    .fail { color: #dc2626; font-weight: 600; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; }
    .metric { background: #f3f4f6; padding: 1rem; border-radius: 8px; }
    .metric strong { display: block; font-size: 1.25rem; }
    li.pass { color: #16a34a; }
    li.fail { color: #dc2626; }
  </style>
</head>
<body>
  <h1>Golden Path — ${report.overallResult.toUpperCase()}</h1>
  <p>Run: <code>${esc(report.runId)}</code> · ${esc(report.generatedAt)} · ${report.durationMs}ms total</p>

  <div class="metrics">
    <div class="metric"><strong>${fmtMs(report.performance.provisioningMs)}</strong>Provisioning</div>
    <div class="metric"><strong>${fmtMs(report.performance.loginMs)}</strong>Login</div>
    <div class="metric"><strong>${fmtMs(report.performance.dashboardMs)}</strong>Dashboard</div>
    <div class="metric"><strong>${fmtMs(report.performance.checkoutMs)}</strong>Checkout</div>
    <div class="metric"><strong>${fmtMs(report.performance.reportMs)}</strong>Reports</div>
  </div>

  <h2>Golden Path Steps (${report.summary.goldenPathPassed}/${report.summary.goldenPathSteps})</h2>
  <table>
    <thead><tr><th>Step</th><th>Result</th><th>Duration</th><th>Errors</th><th>Warnings</th><th>Recommendation</th></tr></thead>
    <tbody>${stepRows}</tbody>
  </table>

  <h2>Negative Tests (${report.summary.negativePassed}/${report.summary.negativeTests})</h2>
  <table>
    <thead><tr><th>Test</th><th>Result</th><th>Duration</th><th>Detail</th></tr></thead>
    <tbody>${negRows}</tbody>
  </table>

  <h2>Validations (${report.summary.validationsPassed}/${report.summary.validationsTotal})</h2>
  <ul>${valItems}</ul>

  ${report.knownIssues.length ? `<h2>Known Issues</h2><ul>${report.knownIssues.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
  ${report.recommendations.length ? `<h2>Recommendations</h2><ul>${report.recommendations.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
</body>
</html>`;
}

export function writeReports(report, outputDir, formats = ['json', 'markdown', 'html']) {
  mkdirSync(outputDir, { recursive: true });
  const base = join(outputDir, report.runId);
  const written = [];

  if (formats.includes('json')) {
    const path = `${base}.json`;
    writeFileSync(path, JSON.stringify(report, null, 2));
    written.push(path);
  }
  if (formats.includes('markdown') || formats.includes('md')) {
    const path = `${base}.md`;
    writeFileSync(path, toMarkdown(report));
    written.push(path);
  }
  if (formats.includes('html')) {
    const path = `${base}.html`;
    writeFileSync(path, toHtml(report));
    written.push(path);
  }

  // Also write latest symlinks/copies
  writeFileSync(join(outputDir, 'latest.json'), JSON.stringify(report, null, 2));
  writeFileSync(join(outputDir, 'latest.md'), toMarkdown(report));
  writeFileSync(join(outputDir, 'latest.html'), toHtml(report));

  return written;
}

export function printSummary(report) {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  RetailX V2 — Golden Path Report (Sprint E2)');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Run ID:     ${report.runId}`);
  console.log(`Result:     ${report.overallResult.toUpperCase()}`);
  console.log(`Duration:   ${report.durationMs}ms`);
  console.log(`Golden:     ${report.summary.goldenPathPassed}/${report.summary.goldenPathSteps} steps`);
  console.log(`Negative:   ${report.summary.negativePassed}/${report.summary.negativeTests} tests`);
  console.log(`Validation: ${report.summary.validationsPassed}/${report.summary.validationsTotal}`);
  console.log('───────────────────────────────────────────────────');
  console.log('Performance:');
  console.log(`  Provisioning  ${fmtMs(report.performance.provisioningMs)}`);
  console.log(`  Login         ${fmtMs(report.performance.loginMs)}`);
  console.log(`  Dashboard     ${fmtMs(report.performance.dashboardMs)}`);
  console.log(`  Checkout      ${fmtMs(report.performance.checkoutMs)}`);
  console.log(`  Reports       ${fmtMs(report.performance.reportMs)}`);
  if (report.goldenPath.some((s) => s.result === 'fail')) {
    console.log('\nFailed steps:');
    for (const s of report.goldenPath.filter((x) => x.result === 'fail')) {
      console.log(`  ✗ ${s.step}: ${s.errors.join('; ')}`);
    }
  }
  console.log('═══════════════════════════════════════════════════\n');
}

function fmtMs(ms) {
  if (ms == null) return '—';
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
