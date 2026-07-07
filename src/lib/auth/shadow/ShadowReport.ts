/**
 * RetailX V2 Milestone D1.3 — Shadow validation health dashboard reports
 */

import type { ComparisonResult } from './ComparisonResult';
import type { IdentityValidationLogEntry } from './ComparisonResult';
import type { ShadowMetricsSnapshot } from './shadow-metrics';

export interface ShadowDashboardReport {
  generatedAt: string;
  milestone: 'D1.3';
  mode: 'shadow';
  metrics: ShadowMetricsSnapshot;
  successPercent: number;
  mismatchPercent: number;
  topMismatchTypes: Array<{ category: string; count: number }>;
  shopsWithMismatches: string[];
  recentComparisons: IdentityValidationLogEntry[];
  historicalTrend: Array<{ index: number; outcome: string; durationMs: number }>;
  performanceBudgetMs: number;
}

export function buildShadowDashboardReport(
  metrics: ShadowMetricsSnapshot,
  logEntries: IdentityValidationLogEntry[]
): ShadowDashboardReport {
  const successPercent =
    metrics.totalLogins > 0
      ? round((metrics.successfulMatches / metrics.totalLogins) * 100)
      : 100;

  const mismatchPercent = round(metrics.mismatchRate);

  const topMismatchTypes = Object.entries(metrics.mismatchByCategory)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const historicalTrend = logEntries.slice(-30).map((entry, index) => ({
    index,
    outcome: entry.outcome,
    durationMs: entry.durationMs,
  }));

  return {
    generatedAt: new Date().toISOString(),
    milestone: 'D1.3',
    mode: 'shadow',
    metrics,
    successPercent,
    mismatchPercent,
    topMismatchTypes,
    shopsWithMismatches: metrics.shopsWithMismatches,
    recentComparisons: logEntries.slice(-20),
    historicalTrend,
    performanceBudgetMs: metrics.performanceBudgetMs,
  };
}

export function toShadowMarkdown(report: ShadowDashboardReport): string {
  const lines = [
    '# Shadow Identity Validation Report',
    '',
    '| Field | Value |',
    '|-------|-------|',
    `| Mode | **SHADOW** (V1 authoritative) |`,
    `| Generated | ${report.generatedAt} |`,
    `| Total Logins Validated | ${report.metrics.totalLogins} |`,
    `| Success Rate | **${report.successPercent}%** |`,
    `| Mismatch Rate | **${report.mismatchPercent}%** |`,
    `| Avg Validation Time | ${report.metrics.averageValidationMs}ms |`,
    `| Max Validation Time | ${report.metrics.maxValidationMs}ms |`,
    `| Performance Budget | ${report.performanceBudgetMs}ms (${report.metrics.withinPerformanceBudget ? 'OK' : 'EXCEEDED'}) |`,
    '',
    '## Top Mismatch Types',
    '',
  ];

  if (report.topMismatchTypes.length === 0) {
    lines.push('_No mismatches recorded._');
  } else {
    for (const item of report.topMismatchTypes) {
      lines.push(`- **${item.category}**: ${item.count}`);
    }
  }

  lines.push('', '## Shops with Mismatches', '');
  if (report.shopsWithMismatches.length === 0) {
    lines.push('_None._');
  } else {
    report.shopsWithMismatches.forEach((s) => lines.push(`- \`${s}\``));
  }

  lines.push('', '## Recent Comparisons', '');
  for (const entry of report.recentComparisons.slice(-10)) {
    const icon = entry.outcome === 'MATCH' ? '✓' : '✗';
    lines.push(
      `- ${icon} ${entry.timestamp} user=\`${entry.userId.slice(0, 8)}…\` ${entry.outcome} (${entry.durationMs}ms)`
    );
  }

  return lines.join('\n');
}

export function toShadowHtml(report: ShadowDashboardReport): string {
  const mismatchRows = report.topMismatchTypes
    .map((r) => `<tr><td>${escapeHtml(r.category)}</td><td>${r.count}</td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Shadow Identity Validation</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; background: #0f0a19; color: #e2e8f0; }
    .card { background: #1a1035; border-radius: 8px; padding: 1.5rem; margin-bottom: 1rem; }
    h1 { color: #a78bfa; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.5rem; border-bottom: 1px solid #334155; text-align: left; }
    .ok { color: #4ade80; } .warn { color: #fbbf24; }
  </style>
</head>
<body>
  <h1>Shadow Identity Validation</h1>
  <p>Mode: SHADOW — V1 authoritative, V2 discarded</p>
  <div class="card">
    <p>Success: <strong class="ok">${report.successPercent}%</strong></p>
    <p>Mismatch: <strong class="${report.mismatchPercent > 0 ? 'warn' : 'ok'}">${report.mismatchPercent}%</strong></p>
    <p>Avg time: ${report.metrics.averageValidationMs}ms / budget ${report.performanceBudgetMs}ms</p>
  </div>
  <div class="card">
    <h2>Top Mismatch Types</h2>
    <table><thead><tr><th>Category</th><th>Count</th></tr></thead>
    <tbody>${mismatchRows || '<tr><td colspan="2">None</td></tr>'}</tbody></table>
  </div>
</body>
</html>`;
}

export function exampleMismatchReport(): ComparisonResult {
  return {
    outcome: 'MISMATCH',
    correlationId: 'shadow-example-001',
    userId: 'b2000000-0000-4000-8000-000000000001',
    shopId: 'a1000000-0000-4000-8000-000000000001',
    email: 'owner@example.com',
    durationMs: 8,
    mismatches: [
      {
        field: 'shopId',
        v1Value: 'a1000000-0000-4000-8000-000000000001',
        v2Value: 'a1000000-0000-4000-8000-000000000002',
        category: 'WRONG_SHOP',
      },
      {
        field: 'membershipId',
        v1Value: null,
        v2Value: null,
        category: 'MISSING_MEMBERSHIP',
      },
    ],
    categories: ['WRONG_SHOP', 'MISSING_MEMBERSHIP'],
    v1Authoritative: true,
    shadowDiscarded: true,
    comparedAt: new Date().toISOString(),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
