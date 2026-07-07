/**
 * RetailX V2 Milestone D1.4 — Pilot dashboard reports
 */

import type { PilotMetricsSnapshot } from './pilot-metrics';
import type { PilotShopRecord } from './types';
import { getEmergencyForceV1 } from './resolve-auth-path';

export interface PilotDashboardReport {
  generatedAt: string;
  milestone: 'D1.4';
  mode: 'pilot';
  metrics: PilotMetricsSnapshot;
  successRate: number;
  mismatchPercent: number;
  performance: {
    averageLoginTimeMs: number;
    maxLoginTimeMs: number;
  };
  rollbackStatus: {
    ready: boolean;
    emergencyForceV1: boolean;
    activePilotCount: number;
    command: string;
  };
  pilotShops: PilotShopRecord[];
  currentUsers: string[];
}

export function buildPilotDashboardReport(
  metrics: PilotMetricsSnapshot,
  pilotShops: PilotShopRecord[]
): PilotDashboardReport {
  const totalLogins = metrics.loginSuccess + metrics.loginFailure;
  const successRate =
    totalLogins > 0 ? round((metrics.loginSuccess / totalLogins) * 100) : 100;

  const emergency = getEmergencyForceV1();

  return {
    generatedAt: new Date().toISOString(),
    milestone: 'D1.4',
    mode: 'pilot',
    metrics,
    successRate,
    mismatchPercent: metrics.shadowMismatchRate,
    performance: {
      averageLoginTimeMs: metrics.averageLoginTimeMs,
      maxLoginTimeMs: metrics.maxLoginTimeMs,
    },
    rollbackStatus: {
      ready: metrics.activePilotShops.length === 0 || emergency,
      emergencyForceV1: emergency,
      activePilotCount: metrics.activePilotShops.length,
      command: 'npm run db:pilot -- disable <shop_id>',
    },
    pilotShops: pilotShops.filter((p) => p.enabled),
    currentUsers: metrics.currentUserIds,
  };
}

export function toPilotMarkdown(report: PilotDashboardReport): string {
  const lines = [
    '# Pilot Shop Dashboard (D1.4)',
    '',
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    `- Success rate: **${report.successRate}%**`,
    `- Shadow mismatch: **${report.mismatchPercent}%**`,
    `- Avg login: **${report.performance.averageLoginTimeMs}ms**`,
    `- Active pilots: **${report.rollbackStatus.activePilotCount}**`,
    '',
    '## Rollback Status',
    `- Ready: ${report.rollbackStatus.ready ? 'YES' : 'NO'}`,
    `- Emergency V1: ${report.rollbackStatus.emergencyForceV1 ? 'ACTIVE' : 'off'}`,
    `- Command: \`${report.rollbackStatus.command}\``,
    '',
    '## Metrics',
    `- Login success: ${report.metrics.loginSuccess}`,
    `- Login failure: ${report.metrics.loginFailure}`,
    `- Shadow matches: ${report.metrics.shadowMatches}`,
    `- Shadow mismatches: ${report.metrics.shadowMismatches}`,
    `- Session errors: ${report.metrics.sessionErrors}`,
    `- Permission errors: ${report.metrics.permissionErrors}`,
    '',
    '## Active Pilot Shops',
  ];

  if (report.pilotShops.length === 0) {
    lines.push('- None');
  } else {
    for (const shop of report.pilotShops) {
      lines.push(`- ${shop.shopId} (enabled by ${shop.enabledBy ?? 'unknown'} at ${shop.enabledAt ?? 'n/a'})`);
    }
  }

  lines.push('', '## Current Users', '');
  if (report.currentUsers.length === 0) {
    lines.push('- None');
  } else {
    for (const uid of report.currentUsers) {
      lines.push(`- ${uid}`);
    }
  }

  return lines.join('\n');
}

export function toPilotHtml(report: PilotDashboardReport): string {
  const shopRows = report.pilotShops
    .map(
      (s) =>
        `<tr><td>${escapeHtml(s.shopId)}</td><td>${escapeHtml(s.enabledBy ?? '')}</td><td>${escapeHtml(s.enabledAt ?? '')}</td></tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html><head><title>Pilot Dashboard D1.4</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; }
  .card { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #eee; padding: 0.5rem; text-align: left; }
</style></head><body>
  <h1>Pilot Shop Dashboard</h1>
  <p>Generated: ${escapeHtml(report.generatedAt)}</p>
  <div class="card">
    <h2>Summary</h2>
    <p>Success: ${report.successRate}% | Mismatch: ${report.mismatchPercent}%</p>
    <p>Avg login: ${report.performance.averageLoginTimeMs}ms</p>
    <p>Rollback ready: ${report.rollbackStatus.ready ? 'YES' : 'NO'}</p>
  </div>
  <div class="card">
    <h2>Active Pilot Shops</h2>
    <table><thead><tr><th>Shop</th><th>Enabled By</th><th>Enabled At</th></tr></thead>
    <tbody>${shopRows || '<tr><td colspan="3">None</td></tr>'}</tbody></table>
  </div>
</body></html>`;
}

export function examplePilotReport(): PilotDashboardReport {
  return buildPilotDashboardReport(
    {
      loginSuccess: 42,
      loginFailure: 2,
      shadowMatches: 38,
      shadowMismatches: 4,
      shadowMismatchRate: 9.52,
      averageLoginTimeMs: 145,
      maxLoginTimeMs: 890,
      sessionErrors: 1,
      permissionErrors: 0,
      activePilotShops: ['a1000000-0000-4000-8000-000000000001'],
      currentUserIds: ['b2000000-0000-4000-8000-000000000001'],
      rollbackReady: false,
      emergencyForceV1: false,
    },
    [
      {
        id: 'p1',
        shopId: 'a1000000-0000-4000-8000-000000000001',
        enabled: true,
        enabledBy: 'ops@retailx.internal',
        enabledAt: new Date().toISOString(),
        notes: 'Internal pilot shop',
      },
    ]
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
