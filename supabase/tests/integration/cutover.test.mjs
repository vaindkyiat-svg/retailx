/**
 * RetailX V2 Milestone C3 — Cutover simulation integration tests
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, resolveEnvironment } from '../../../scripts/infrastructure/lib/helpers.mjs';
import { runCutoverPipeline } from '../../../scripts/infrastructure/cutover/lib/pipeline.mjs';
import { writeCutoverReports } from '../../../scripts/infrastructure/cutover/lib/reports.mjs';

const hasDatabase = !!process.env.DATABASE_URL;

describe('Milestone C3 cutover integration', { skip: !hasDatabase }, () => {
  let client;

  before(async () => {
    client = await createClient(resolveEnvironment('development'));
  });

  after(async () => {
    if (client) await client.end();
  });

  it('full cutover pipeline with fixture passes', async () => {
    const report = await runCutoverPipeline(client, {
      useFixture: true,
      autoRepair: false,
      environment: 'development',
    });

    assert.ok(['passed', 'passed_with_warnings'].includes(report.status));
    assert.equal(report.healthScore.overall, 100);
    assert.equal(report.steps.simulations.allPassed, true);
    assert.equal(report.steps.rollback_validation.migrations.ready, true);
    assert.ok(report.totalDurationMs > 0);
  });

  it('generates cutover, performance, and risk reports', async () => {
    const report = await runCutoverPipeline(client, {
      useFixture: false,
      autoRepair: false,
      environment: 'development',
    });

    const { performance, risk, files } = writeCutoverReports(report, 'reports/cutover-test');
    assert.equal(files.length, 4);
    assert.ok(performance.totalDurationMs >= 0);
    assert.ok(['low', 'medium', 'high'].includes(risk.overallRisk));
  });

  it('re-run is idempotent', async () => {
    const first = await runCutoverPipeline(client, { useFixture: false, environment: 'development' });
    const second = await runCutoverPipeline(client, { useFixture: false, environment: 'development' });

    assert.equal(first.healthScore.overall, second.healthScore.overall);
    assert.equal(second.steps.backfill.inserted ?? 0, 0);
  });

  it('all 12 simulations pass on healthy database', async () => {
    const report = await runCutoverPipeline(client, { useFixture: false, environment: 'development' });
    assert.equal(report.steps.simulations.total, 12);
    assert.equal(report.steps.simulations.failed, 0);
  });
});

if (!hasDatabase) {
  console.log('Skipping Milestone C3 integration tests — DATABASE_URL not set');
}
