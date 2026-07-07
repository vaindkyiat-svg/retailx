/**
 * RetailX V2 Sprint E2 — Golden path live integration (requires Supabase env)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectRoot } from '../../../scripts/infrastructure/lib/helpers.mjs';
import { loadEnv, requireSupabaseEnv } from '../../../scripts/golden-path/lib/env.mjs';
import { runGoldenPath } from '../../../scripts/golden-path/lib/golden-path.mjs';
import { runNegativeTests } from '../../../scripts/golden-path/lib/negative.mjs';
import { buildReport, writeReports } from '../../../scripts/golden-path/lib/report.mjs';

function hasLiveSupabase() {
  if (process.env.GOLDEN_PATH_LIVE !== 'true') return false;
  try {
    const env = loadEnv();
    requireSupabaseEnv(env);
    return !!env.supabaseUrl && !!env.serviceRoleKey;
  } catch {
    return false;
  }
}

describe('Sprint E2 golden path live integration', { skip: !hasLiveSupabase() }, () => {
  it('completes golden path with validations', async () => {
    const env = loadEnv();
    const result = await runGoldenPath(env);

    assert.ok(result.steps.length >= 10, 'Expected at least 10 golden path steps');
    const failed = result.steps.filter((s) => s.result === 'fail');
    assert.equal(
      failed.length,
      0,
      `Failed steps: ${failed.map((s) => `${s.step}: ${s.errors.join('; ')}`).join(' | ')}`
    );
    assert.ok(result.validations.allPassed, 'Entity validations should all pass');
  }, { timeout: 120_000 });

  it('negative tests pass', async () => {
    const env = loadEnv();
    const results = await runNegativeTests(env);
    const failed = results.filter((r) => r.result === 'fail');
    assert.equal(
      failed.length,
      0,
      `Failed negative tests: ${failed.map((r) => r.name).join(', ')}`
    );
  }, { timeout: 180_000 });

  it('writes JSON, Markdown, and HTML reports', async () => {
    const env = loadEnv();
    const golden = await runGoldenPath(env);
    const negative = await runNegativeTests(env);
    const runId = `integration-${Date.now()}`;
    const report = buildReport({
      runId,
      goldenPath: golden.steps,
      negativeTests: negative,
      performance: golden.performance,
      validations: golden.validations,
      context: golden.context,
      knownIssues: golden.knownIssues,
      overallResult: golden.overallResult,
      durationMs: 1,
    });

    const outDir = join(getProjectRoot(), 'reports', 'golden-path', 'integration');
    const written = writeReports(report, outDir);
    assert.ok(written.some((f) => f.endsWith('.json')));
    assert.ok(written.some((f) => f.endsWith('.md')));
    assert.ok(written.some((f) => f.endsWith('.html')));
    assert.ok(existsSync(join(outDir, 'latest.json')));
  }, { timeout: 180_000 });
});

describe('Sprint E2 golden path report artifacts', () => {
  it('report schema includes required fields', () => {
    const sample = buildReport({
      runId: 'test-run',
      goldenPath: [{ step: 'test', result: 'pass', durationMs: 1, errors: [], warnings: [], recommendation: null }],
      negativeTests: [],
      performance: { provisioningMs: 100, loginMs: 50, dashboardMs: 80, checkoutMs: 200, reportMs: 30, totalMs: 460 },
      validations: { passed: 5, total: 5, items: {} },
      context: {},
      knownIssues: [],
      overallResult: 'pass',
      durationMs: 500,
    });

    assert.equal(sample.sprint, 'E2');
    assert.ok(Array.isArray(sample.goldenPath));
    assert.ok(sample.performance.provisioningMs != null);
    assert.ok(sample.summary);
  });
});
