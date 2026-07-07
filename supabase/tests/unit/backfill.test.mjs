/**
 * RetailX V2 Milestone C1 — Backfill unit tests (no database required)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  mapLegacyPlanToCode,
  V1_ROLE_TO_V2_SLUG,
  DEFAULT_SHOP_SETTINGS,
  BACKFILL_BRANCH_CODE,
  BACKFILL_WAREHOUSE_CODE,
} from '../../../scripts/infrastructure/backfill/lib/mappings.mjs';
import { createReport, initStep, finalizeStep, finalizeReport } from '../../../scripts/infrastructure/backfill/lib/report.mjs';
import { getProjectRoot, listMigrationFiles } from '../../../scripts/infrastructure/lib/helpers.mjs';

describe('C1 plan mapping', () => {
  it('maps V1 standard to starter', () => {
    assert.equal(mapLegacyPlanToCode('standard'), 'starter');
  });

  it('maps unknown plans to starter default', () => {
    assert.equal(mapLegacyPlanToCode('legacy_xyz'), 'starter');
  });

  it('maps growth and enterprise', () => {
    assert.equal(mapLegacyPlanToCode('growth'), 'growth');
    assert.equal(mapLegacyPlanToCode('enterprise'), 'enterprise');
  });

  it('is case insensitive', () => {
    assert.equal(mapLegacyPlanToCode('GROWTH'), 'growth');
  });
});

describe('C1 role mapping', () => {
  it('maps shop_owner and admin', () => {
    assert.equal(V1_ROLE_TO_V2_SLUG.shop_owner, 'shop_owner');
    assert.equal(V1_ROLE_TO_V2_SLUG.admin, 'platform_admin');
  });
});

describe('C1 backfill constants', () => {
  it('uses MAIN and DEFAULT codes', () => {
    assert.equal(BACKFILL_BRANCH_CODE, 'MAIN');
    assert.equal(BACKFILL_WAREHOUSE_CODE, 'DEFAULT');
  });

  it('defines default shop settings', () => {
    assert.ok(DEFAULT_SHOP_SETTINGS.length >= 4);
    const keys = DEFAULT_SHOP_SETTINGS.map((s) => s.key);
    assert.ok(keys.includes('pos.currency_default'));
  });
});

describe('C1 report builder', () => {
  it('aggregates step counts', () => {
    const report = createReport('test-run');
    report.steps.a = initStep('a');
    report.steps.a.processed = 10;
    report.steps.a.inserted = 7;
    report.steps.a.skipped = 3;
    finalizeStep(report.steps.a);
    finalizeStep(report.steps.b ?? initStep('b'));

    finalizeReport(report);
    assert.equal(report.summary.rowsProcessed, 10);
    assert.equal(report.summary.rowsInserted, 7);
    assert.equal(report.summary.rowsSkipped, 3);
  });
});

describe('C1 migration and scripts', () => {
  const root = getProjectRoot();

  it('includes backfill_audit migration', () => {
    const files = listMigrationFiles();
    const c1 = files.find((f) => f.name === 'backfill_audit');
    assert.ok(c1, 'Missing backfill_audit migration');
  });

  it('has rollback for backfill_audit', () => {
    const rollbacks = readdirSync(join(root, 'supabase', 'migrations', 'rollback'));
    assert.ok(rollbacks.some((r) => r.includes('20260707120000')));
  });

  it('backfill scripts exist', () => {
    const scripts = [
      'scripts/infrastructure/backfill.mjs',
      'scripts/infrastructure/verify-backfill.mjs',
      'scripts/infrastructure/rollback-backfill.mjs',
      'scripts/infrastructure/backfill/lib/steps.mjs',
      'scripts/infrastructure/backfill/lib/verify.mjs',
      'supabase/tests/fixtures/v1_sample.sql',
    ];
    for (const s of scripts) {
      assert.ok(existsSync(join(root, s)), `Missing: ${s}`);
    }
  });

  it('backfill migration does not alter V1 tables', () => {
    const sql = readFileSync(
      join(root, 'supabase', 'migrations', '20260707120000_backfill_audit.sql'),
      'utf8'
    );
    assert.ok(!sql.includes('ALTER TABLE public.shops'));
    assert.ok(!sql.includes('DROP TABLE'));
  });
});
