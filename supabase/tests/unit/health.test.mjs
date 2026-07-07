/**
 * RetailX V2 Milestone C2 — Health engine unit tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { HEALTH_CHECKS, ARCHITECTURE_CHECKS } from '../../../scripts/infrastructure/health/lib/checks.mjs';
import { calculateHealthScore, collectRepairSuggestions } from '../../../scripts/infrastructure/health/lib/score.mjs';
import { REPAIR_TARGETS } from '../../../scripts/infrastructure/health/lib/repair.mjs';
import { toMarkdown, buildHealthReport } from '../../../scripts/infrastructure/health/lib/reports.mjs';
import { getProjectRoot, listMigrationFiles } from '../../../scripts/infrastructure/lib/helpers.mjs';

describe('C2 health checks', () => {
  it('defines checks for all required domains', () => {
    const categories = new Set(HEALTH_CHECKS.map((c) => c.category));
    for (const cat of ['memberships', 'branches', 'warehouses', 'settings', 'subscriptions']) {
      assert.ok(categories.has(cat), `Missing category: ${cat}`);
    }
  });

  it('has integrity checks for duplicates and orphans', () => {
    const names = HEALTH_CHECKS.map((c) => c.name);
    assert.ok(names.includes('no_duplicate_memberships'));
    assert.ok(names.includes('no_duplicate_primary_owners'));
    assert.ok(names.includes('no_multiple_default_branches'));
    assert.ok(names.includes('orphan_subscriptions'));
  });

  it('has operations checks for outbox and invitations', () => {
    const names = HEALTH_CHECKS.map((c) => c.name);
    assert.ok(names.includes('outbox_stuck_processing'));
    assert.ok(names.includes('expired_pending_invitations'));
  });

  it('defines architecture checks', () => {
    assert.equal(ARCHITECTURE_CHECKS.length, 2);
  });
});

describe('C2 health score', () => {
  it('calculates 100% when all checks pass', () => {
    const checks = [
      { category: 'memberships', passed: true, severity: 'error' },
      { category: 'memberships', passed: true, severity: 'error' },
      { category: 'branches', passed: true, severity: 'error' },
      { category: 'warehouses', passed: true, severity: 'error' },
      { category: 'settings', passed: true, severity: 'error' },
      { category: 'subscriptions', passed: true, severity: 'error' },
    ];
    const score = calculateHealthScore(checks);
    assert.equal(score.overall, 100);
    assert.equal(score.status, 'healthy');
  });

  it('degrades score when errors present', () => {
    const checks = [
      { category: 'memberships', passed: false, severity: 'error' },
      { category: 'memberships', passed: true, severity: 'error' },
      { category: 'branches', passed: true, severity: 'error' },
      { category: 'warehouses', passed: true, severity: 'error' },
      { category: 'settings', passed: true, severity: 'error' },
      { category: 'subscriptions', passed: true, severity: 'error' },
    ];
    const score = calculateHealthScore(checks);
    assert.ok(score.overall < 100);
    assert.ok(score.categories.memberships.score === 50);
  });

  it('collects repair suggestions from failed checks', () => {
    const checks = [
      { name: 'every_shop_has_subscription', passed: false, severity: 'error', repair: 'subscriptions', count: 2 },
      { name: 'every_shop_has_main_branch', passed: false, severity: 'error', repair: 'branches', count: 1 },
    ];
    const suggestions = collectRepairSuggestions(checks);
    assert.ok(suggestions.subscriptions);
    assert.ok(suggestions.branches);
  });
});

describe('C2 repair targets', () => {
  it('includes all required repair commands', () => {
    for (const t of ['memberships', 'branches', 'warehouses', 'settings', 'subscriptions', 'defaults', 'all']) {
      assert.ok(REPAIR_TARGETS.includes(t));
    }
  });
});

describe('C2 report generation', () => {
  it('generates markdown report', () => {
    const report = buildHealthReport({
      runId: 'test-run',
      environment: 'development',
      trigger: 'manual',
      health: { overall: 99.98, status: 'healthy', categories: { memberships: { score: 100, passed: 7, total: 7 } } },
      checks: [{ name: 'test_check', category: 'memberships', passed: true, severity: 'error', count: 0 }],
      architecture: [],
      repairSuggestions: {},
      durationMs: 100,
    });
    const md = toMarkdown(report);
    assert.ok(md.includes('99.98%'));
    assert.ok(md.includes('test-run'));
  });
});

describe('C2 migration and scripts', () => {
  const root = getProjectRoot();

  it('includes health_engine migration', () => {
    const files = listMigrationFiles();
    assert.ok(files.some((f) => f.name === 'health_engine'));
  });

  it('health scripts exist', () => {
    const scripts = [
      'scripts/infrastructure/health.mjs',
      'scripts/infrastructure/repair.mjs',
      'scripts/infrastructure/health/lib/checks.mjs',
      'scripts/infrastructure/health/lib/score.mjs',
      'scripts/infrastructure/health/lib/repair.mjs',
      'scripts/infrastructure/health/lib/reports.mjs',
      'supabase/config/health-schedule.json',
    ];
    for (const s of scripts) {
      assert.ok(existsSync(join(root, s)), `Missing: ${s}`);
    }
  });

  it('has rollback for health_engine', () => {
    const rollbacks = readdirSync(join(root, 'supabase', 'migrations', 'rollback'));
    assert.ok(rollbacks.some((r) => r.includes('20260707130000')));
  });
});
