/**
 * RetailX V2 Milestone D1.4A — Release engineering dashboard reports
 */

import type { AuthIncident, ReleaseDecision, ReleaseHistoryEntry } from './ReleaseDecision';
import type { ReleaseMetricsSnapshot } from './ReleaseMetrics';
import type { PilotShopRecord } from '../pilot/types';

export interface ReleaseDashboardReport {
  generatedAt: string;
  milestone: 'D1.4A';
  currentPilot: PilotShopRecord | null;
  currentPhase: string;
  lastDecision: ReleaseDecisionType | null;
  health: {
    score: number;
    databaseOk: boolean;
    architectureOk: boolean;
  };
  shadow: {
    matchPercent: number;
    mismatchPercent: number;
    totalLogins: number;
  };
  performance: {
    loginSuccessPercent: number;
    averageLoginTimeMs: number;
    maxLoginTimeMs: number;
  };
  openIncidents: AuthIncident[];
  recentHistory: ReleaseHistoryEntry[];
  rollbackCommand: string;
}

type ReleaseDecisionType = ReleaseDecision['decision'];

export function buildReleaseDashboardReport(input: {
  metrics: ReleaseMetricsSnapshot;
  pilotShops: PilotShopRecord[];
  lastDecision: ReleaseDecision | null;
  openIncidents: AuthIncident[];
  recentHistory: ReleaseHistoryEntry[];
}): ReleaseDashboardReport {
  const activePilot = input.pilotShops.find((p) => p.enabled) ?? null;

  return {
    generatedAt: new Date().toISOString(),
    milestone: 'D1.4A',
    currentPilot: activePilot,
    currentPhase: input.lastDecision?.phase ?? 'pre_rollout',
    lastDecision: input.lastDecision?.decision ?? null,
    health: {
      score: input.metrics.healthScore,
      databaseOk: input.metrics.databaseHealthOk,
      architectureOk: input.metrics.architectureValidationPassed,
    },
    shadow: {
      matchPercent: input.metrics.shadowMatchPercent,
      mismatchPercent: input.metrics.shadowMismatchPercent,
      totalLogins: input.metrics.shadowTotalLogins,
    },
    performance: {
      loginSuccessPercent: input.metrics.loginSuccessPercent,
      averageLoginTimeMs: input.metrics.averageLoginTimeMs,
      maxLoginTimeMs: input.metrics.maxLoginTimeMs,
    },
    openIncidents: input.openIncidents,
    recentHistory: input.recentHistory,
    rollbackCommand: activePilot
      ? `npm run db:pilot -- disable ${activePilot.shopId}`
      : 'npm run db:pilot -- status',
  };
}

export function toReleaseMarkdown(report: ReleaseDashboardReport): string {
  const lines = [
    '# Release Engineering Dashboard (D1.4A)',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Status',
    `- Phase: **${report.currentPhase}**`,
    `- Last decision: **${report.lastDecision ?? 'none'}**`,
    `- Active pilot: **${report.currentPilot?.shopId ?? 'none'}**`,
    '',
    '## Health',
    `- Score: ${report.health.score}`,
    `- Database: ${report.health.databaseOk ? 'OK' : 'FAIL'}`,
    `- Architecture: ${report.health.architectureOk ? 'OK' : 'FAIL'}`,
    '',
    '## Shadow Validation',
    `- Match: ${report.shadow.matchPercent}%`,
    `- Mismatch: ${report.shadow.mismatchPercent}%`,
    '',
    '## Performance',
    `- Login success: ${report.performance.loginSuccessPercent}%`,
    `- Avg login: ${report.performance.averageLoginTimeMs}ms`,
    '',
    '## Open Incidents',
  ];

  if (report.openIncidents.length === 0) {
    lines.push('- None');
  } else {
    for (const inc of report.openIncidents) {
      lines.push(`- [${inc.severity}] ${inc.category}: ${inc.reason}`);
    }
  }

  lines.push('', '## Rollback', `- Command: \`${report.rollbackCommand}\``);

  return lines.join('\n');
}

export function toReleaseHtml(report: ReleaseDashboardReport): string {
  const incidentRows = report.openIncidents
    .map(
      (i) =>
        `<tr><td>${i.severity}</td><td>${i.category}</td><td>${escapeHtml(i.reason)}</td></tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html><head><title>Release Dashboard D1.4A</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #eee; padding: 0.5rem; }
</style></head><body>
  <h1>Release Engineering Dashboard</h1>
  <div class="card">
    <p>Decision: <strong>${report.lastDecision ?? 'none'}</strong></p>
    <p>Pilot: ${report.currentPilot?.shopId ?? 'none'}</p>
    <p>Shadow match: ${report.shadow.matchPercent}%</p>
  </div>
  <div class="card">
    <h2>Open Incidents</h2>
    <table><thead><tr><th>Severity</th><th>Category</th><th>Reason</th></tr></thead>
    <tbody>${incidentRows || '<tr><td colspan="3">None</td></tr>'}</tbody></table>
  </div>
</body></html>`;
}

export function exampleGoReport(): ReleaseDecision {
  return {
    decision: 'GO',
    phase: 'pre_rollout',
    shopId: 'a1000000-0000-4000-8000-000000000001',
    version: 'D1.4A',
    reasons: ['All release gates passed'],
    gates: [],
    evaluatedAt: new Date().toISOString(),
    correlationId: 'release-example-go',
    metricsSnapshot: {
      shadowMatchPercent: 96.5,
      loginSuccessPercent: 98.2,
      shadowMismatchPercent: 3.5,
    },
    automaticRollbackTriggered: false,
    emergencyOverrideActive: false,
  };
}

export function exampleRollbackReport(): ReleaseDecision {
  return {
    decision: 'ROLLBACK',
    phase: 'pilot_active',
    shopId: 'a1000000-0000-4000-8000-000000000001',
    version: 'D1.4A',
    reasons: [
      'Maximum Mismatch %: actual 15 fails max 10',
      'Automatic pilot rollback threshold crossed',
    ],
    gates: [
      {
        gateId: 'maximum_mismatch_percent',
        label: 'Maximum Mismatch %',
        passed: false,
        actual: 15,
        threshold: 10,
        operator: 'max',
        reason: 'Maximum Mismatch %: actual 15 fails max 10',
      },
    ],
    evaluatedAt: new Date().toISOString(),
    correlationId: 'release-example-rollback',
    metricsSnapshot: {
      shadowMismatchPercent: 15,
      shadowMatchPercent: 85,
    },
    automaticRollbackTriggered: true,
    emergencyOverrideActive: false,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
