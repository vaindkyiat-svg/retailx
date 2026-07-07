/**
 * RetailX V2 Milestone C2 — Health report generators (JSON, Markdown, HTML)
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export function buildHealthReport({
  runId,
  environment,
  trigger,
  health,
  checks,
  architecture,
  repairSuggestions,
  history,
  durationMs,
}) {
  const allChecks = [...checks, ...architecture];
  const errors = allChecks.filter((c) => !c.passed && c.severity === 'error');
  const warnings = allChecks.filter((c) => !c.passed && c.severity === 'warning');

  return {
    runId,
    milestone: 'C2',
    environment,
    trigger,
    generatedAt: new Date().toISOString(),
    durationMs,
    status: health.status,
    healthScore: health,
    summary: {
      totalChecks: allChecks.length,
      passed: allChecks.filter((c) => c.passed).length,
      errors: errors.length,
      warnings: warnings.length,
    },
    checks: allChecks,
    repairSuggestions,
    history: history ?? null,
  };
}

export function toMarkdown(report) {
  const lines = [
    `# RetailX Health Report`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| Run ID | \`${report.runId}\` |`,
    `| Status | **${report.status}** |`,
    `| Overall Score | **${report.healthScore.overall}%** |`,
    `| Environment | ${report.environment} |`,
    `| Trigger | ${report.trigger} |`,
    `| Duration | ${report.durationMs}ms |`,
    `| Checks | ${report.summary.passed}/${report.summary.totalChecks} passed |`,
    ``,
    `## Health Score`,
    ``,
    `| Domain | Score |`,
    `|--------|-------|`,
  ];

  for (const [cat, data] of Object.entries(report.healthScore.categories)) {
    lines.push(`| ${capitalize(cat)} | ${data.score}% (${data.passed}/${data.total}) |`);
  }
  lines.push(`| **Overall** | **${report.healthScore.overall}%** |`);
  lines.push('');

  if (report.history?.previous) {
    const delta = report.healthScore.overall - report.history.previous.score;
    const sign = delta >= 0 ? '+' : '';
    lines.push(`## Historical Comparison`);
    lines.push('');
    lines.push(`Previous run (\`${report.history.previous.runId}\`): ${report.history.previous.score}%`);
    lines.push(`Delta: ${sign}${round(delta)}%`);
    lines.push('');
  }

  if (report.summary.errors > 0) {
    lines.push('## Errors');
    lines.push('');
    for (const c of report.checks.filter((x) => !x.passed && x.severity === 'error')) {
      lines.push(`- **${c.name}** (${c.category}): ${c.detail ?? c.count + ' issues'}`);
      if (c.repair) lines.push(`  - Repair: \`npm run db:repair -- ${c.repair}\``);
    }
    lines.push('');
  }

  if (report.summary.warnings > 0) {
    lines.push('## Warnings');
    lines.push('');
    for (const c of report.checks.filter((x) => !x.passed && x.severity === 'warning')) {
      lines.push(`- ${c.name}: ${c.detail ?? c.count + ' issues'}`);
    }
    lines.push('');
  }

  if (Object.keys(report.repairSuggestions ?? {}).length > 0) {
    lines.push('## Repair Suggestions');
    lines.push('');
    for (const [cmd, items] of Object.entries(report.repairSuggestions)) {
      lines.push(`### repair-${cmd}`);
      for (const item of items) {
        lines.push(`- ${item.check} (${item.count} issues)`);
      }
      lines.push(`\`\`\`bash\nnpm run db:repair -- ${cmd} --dry-run\n\`\`\``);
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function toHtml(report) {
  const md = toMarkdown(report);
  const body = md
    .replace(/^# (.+)$/m, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    .replace(/\|(.+)\|/g, (line) => {
      if (line.includes('---')) return '';
      const cells = line.split('|').filter(Boolean).map((c) => `<td>${c.trim()}</td>`);
      return `<tr>${cells.join('')}</tr>`;
    });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>RetailX Health Report — ${report.runId}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
    h1 { color: ${report.status === 'healthy' ? '#16a34a' : report.status === 'degraded' ? '#ca8a04' : '#dc2626'}; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    td, th { border: 1px solid #e5e7eb; padding: 0.5rem 0.75rem; text-align: left; }
    code { background: #f3f4f6; padding: 0.15rem 0.4rem; border-radius: 4px; }
    .score { font-size: 2rem; font-weight: bold; }
  </style>
</head>
<body>
  <p class="score">${report.healthScore.overall}%</p>
  <p>Status: <strong>${report.status}</strong> · ${report.summary.passed}/${report.summary.totalChecks} checks passed</p>
  <pre>${escapeHtml(JSON.stringify(report.healthScore.categories, null, 2))}</pre>
  <hr>
  ${body.replace(/\n/g, '<br>\n')}
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

  return written;
}

export function toRepairMarkdown(report) {
  return [
    `# RetailX Repair Report`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| Run ID | \`${report.runId}\` |`,
    `| Target | ${report.target} |`,
    `| Dry Run | ${report.dryRun} |`,
    `| Duration | ${report.durationMs}ms |`,
    `| Processed | ${report.summary.processed} |`,
    `| Inserted/Repaired | ${report.summary.inserted} |`,
    `| Skipped | ${report.summary.skipped} |`,
    ``,
    `## Steps`,
    ``,
    ...Object.entries(report.steps).map(([name, step]) =>
      `### ${name}\n- processed: ${step.processed}\n- inserted: ${step.inserted}\n- skipped: ${step.skipped}`
    ),
  ].join('\n');
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function round(n) {
  return Math.round(n * 100) / 100;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function printHealthSummary(report) {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  RetailX V2 — Health Engine Report');
  console.log('═══════════════════════════════════════════════════');
  console.log(`Run ID:    ${report.runId}`);
  console.log(`Status:    ${report.status}`);
  console.log(`Score:     ${report.healthScore.overall}%`);
  console.log(`Checks:    ${report.summary.passed}/${report.summary.totalChecks} passed`);
  console.log(`Errors:    ${report.summary.errors}`);
  console.log(`Warnings:  ${report.summary.warnings}`);
  console.log('───────────────────────────────────────────────────');
  console.log('Domain Scores:');
  for (const [cat, data] of Object.entries(report.healthScore.categories)) {
    console.log(`  ${cat.padEnd(16)} ${data.score}%`);
  }
  if (report.history?.previous) {
    const delta = report.healthScore.overall - report.history.previous.score;
    console.log(`\nPrevious:  ${report.history.previous.score}% (${sign(delta)}${round(delta)}%)`);
  }
  if (report.summary.errors > 0) {
    console.log('\nFailed checks:');
    for (const c of report.checks.filter((x) => !x.passed && x.severity === 'error')) {
      console.log(`  ✗ ${c.name} — ${c.detail ?? c.count}`);
    }
  }
  console.log('═══════════════════════════════════════════════════\n');
}

function sign(n) {
  return n >= 0 ? '+' : '';
}
