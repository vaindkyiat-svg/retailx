/**
 * RetailX V2 Milestone C3 — Cutover simulation unit tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { validateRollbackReadiness } from '../../../scripts/infrastructure/cutover/lib/rollback-validation.mjs';
import { buildRiskReport, buildPerformanceReport } from '../../../scripts/infrastructure/cutover/lib/reports.mjs';
import { createMetricsCollector } from '../../../scripts/infrastructure/cutover/lib/metrics.mjs';
import { getProjectRoot, listMigrationFiles } from '../../../scripts/infrastructure/lib/helpers.mjs';

describe('C3 rollback validation', () => {
  it('validates all migrations have rollbacks', () => {
    const result = validateRollbackReadiness();
    assert.equal(result.ready, true);
    assert.equal(result.score, 100);
    assert.equal(result.checks.length, listMigrationFiles().length);
  });

  it('rollbacks do not drop V1 tables', () => {
    const result = validateRollbackReadiness();
    for (const check of result.checks) {
      assert.equal(check.v1Safe, true, `${check.migration} rollback unsafe`);
    }
  });
});

describe('C3 risk report', () => {
  it('marks cutover ready at 100% health', () => {
    const risk = buildRiskReport({
      healthScore: { overall: 100 },
      steps: {
        verification: { passed: true },
        simulations: { failed: 0 },
        rollback_validation: { migrations: { ready: true } },
      },
      databaseStats: { rowCounts: { shops: 3, memberships: 3 } },
      performance: { phases: [] },
    });
    assert.equal(risk.cutoverReady, true);
    assert.equal(risk.overallRisk, 'low');
  });

  it('flags high risk on simulation failures', () => {
    const risk = buildRiskReport({
      healthScore: { overall: 95 },
      steps: {
        simulations: { failed: 2 },
        rollback_validation: { migrations: { ready: false } },
      },
      performance: { phases: [] },
    });
    assert.equal(risk.overallRisk, 'high');
    assert.equal(risk.cutoverReady, false);
  });
});

describe('C3 performance report', () => {
  it('builds performance metrics from cutover report', () => {
    const perf = buildPerformanceReport({
      totalDurationMs: 5000,
      performance: {
        phases: [{ name: 'migrations', durationMs: 2000 }],
        memory: { peakHeapMb: 64 },
      },
      steps: {
        simulations: {
          simulations: [
            { name: 'product_queries', durationMs: 12, rowCount: 5 },
          ],
        },
      },
      databaseStats: { connections: { active: 2 } },
    });
    assert.equal(perf.totalDurationMs, 5000);
    assert.equal(perf.withinThresholds.queries, true);
  });
});

describe('C3 metrics collector', () => {
  it('tracks phase durations', () => {
    const metrics = createMetricsCollector();
    const ctx = metrics.startPhase('test');
    const entry = metrics.endPhase(ctx);
    assert.ok(entry.durationMs >= 0);
    assert.equal(entry.name, 'test');
  });
});

describe('C3 files and migration', () => {
  const root = getProjectRoot();

  it('includes cutover_simulation migration', () => {
    const files = listMigrationFiles();
    assert.ok(files.some((f) => f.name === 'cutover_simulation'));
  });

  it('cutover scripts and fixtures exist', () => {
    const paths = [
      'scripts/infrastructure/cutover.mjs',
      'scripts/infrastructure/cutover/lib/pipeline.mjs',
      'scripts/infrastructure/cutover/lib/simulations.mjs',
      'scripts/infrastructure/cutover/lib/reports.mjs',
      'supabase/tests/fixtures/staging_snapshot.sql',
      'supabase/tests/fixtures/staging_v1_business.sql',
    ];
    for (const p of paths) {
      assert.ok(existsSync(join(root, p)), `Missing: ${p}`);
    }
  });

  it('has rollback for cutover_simulation', () => {
    const rollbacks = readdirSync(join(root, 'supabase/migrations/rollback'));
    assert.ok(rollbacks.some((r) => r.includes('20260707140000')));
  });
});
