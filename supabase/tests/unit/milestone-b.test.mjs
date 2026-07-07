/**
 * RetailX V2 Milestone B — Database schema unit tests (no database required)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { listMigrationFiles, getProjectRoot } from '../../../scripts/infrastructure/lib/helpers.mjs';

const MILESTONE_B_TABLES = [
  'memberships',
  'branches',
  'warehouses',
  'shop_settings',
  'subscriptions',
  'invitations',
  'user_devices',
  'event_outbox',
  'audit_logs',
];

const MILESTONE_B_FUNCTIONS = [
  'private.current_user_id',
  'private.current_shop_id',
  'private.current_membership',
  'private.is_platform_admin',
  'private.is_shop_member',
  'private.set_updated_at',
];

const MILESTONE_B_VIEWS = [
  'system_settings',
  'v_user_shop_context',
  'v_shop_tenancy_summary',
];

function readMigration(name) {
  const path = join(getProjectRoot(), 'supabase', 'migrations', name);
  return readFileSync(path, 'utf8');
}

function milestoneBMigrations() {
  return listMigrationFiles().filter(
    (f) => f.version >= '20260707110000' && f.version < '20260707120000'
  );
}

describe('Milestone B migrations', () => {
  it('includes 8 new migrations', () => {
    const migs = milestoneBMigrations();
    assert.equal(migs.length, 8);
  });

  it('has rollback for every Milestone B migration', () => {
    const rollbackDir = join(getProjectRoot(), 'supabase', 'migrations', 'rollback');
    const rollbacks = readdirSync(rollbackDir).filter((f) => f.endsWith('.sql'));

    for (const mig of milestoneBMigrations()) {
      const match = rollbacks.find((r) => r.startsWith(mig.version));
      assert.ok(match, `Missing rollback for ${mig.filename}`);
    }
  });

  it('does not contain destructive V1 operations', () => {
    const forbidden = [
      /DROP\s+TABLE\s+public\.shops/i,
      /DROP\s+TABLE\s+public\.user_profiles/i,
      /DROP\s+TABLE\s+public\.products/i,
      /DROP\s+COLUMN/i,
      /ALTER\s+TABLE\s+public\.shops\s+DROP/i,
      /ALTER\s+TABLE\s+public\.user_profiles\s+DROP/i,
    ];

    for (const mig of milestoneBMigrations()) {
      const content = readFileSync(mig.path, 'utf8');
      for (const pattern of forbidden) {
        assert.ok(
          !pattern.test(content),
          `${mig.filename} contains forbidden pattern: ${pattern}`
        );
      }
    }
  });

  it('creates all required V2 tables', () => {
    const tenancy = readMigration('20260707110001_tenancy_tables.sql');
    const operational = readMigration('20260707110002_operational_tables.sql');

    for (const table of MILESTONE_B_TABLES) {
      const sql = tenancy.includes(table) || operational.includes(table);
      assert.ok(sql, `Missing table: ${table}`);
      assert.ok(
        tenancy.includes(`CREATE TABLE IF NOT EXISTS public.${table}`) ||
          operational.includes(`CREATE TABLE IF NOT EXISTS public.${table}`),
        `Missing CREATE TABLE for ${table}`
      );
    }
  });

  it('defines private helper functions', () => {
    const helpers = readMigration('20260707110004_private_helpers.sql');
    for (const fn of MILESTONE_B_FUNCTIONS.filter((f) => f !== 'private.set_updated_at')) {
      const name = fn.split('.')[1];
      assert.ok(helpers.includes(name), `Missing function: ${fn}`);
    }
  });

  it('defines updated_at trigger function', () => {
    const triggers = readMigration('20260707110003_infrastructure_triggers.sql');
    assert.ok(triggers.includes('private.set_updated_at'));
    assert.ok(triggers.includes("'memberships'"));
    assert.ok(triggers.includes('trg_%I_set_updated_at'));
  });

  it('creates compatibility views', () => {
    const views = readMigration('20260707110006_compatibility_views.sql');
    for (const view of MILESTONE_B_VIEWS) {
      assert.ok(views.includes(view), `Missing view: ${view}`);
    }
  });

  it('enables RLS on V2 tables without touching V1 policies', () => {
    const rls = readMigration('20260707110007_rls_skeleton.sql');
    for (const table of MILESTONE_B_TABLES) {
      assert.ok(
        rls.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`),
        `RLS not enabled on ${table}`
      );
    }
    assert.ok(!rls.includes('public.shops ENABLE'));
    assert.ok(!rls.includes('public.user_profiles ENABLE'));
  });

  it('documents indexes with comments', () => {
    const indexes = readMigration('20260707110005_milestone_b_indexes.sql');
    const requiredIndexes = [
      'idx_memberships_shop_id',
      'idx_memberships_user_id',
      'idx_branches_shop_id',
      'idx_warehouses_branch_id',
      'idx_subscriptions_shop_id',
      'idx_invitations_email',
      'idx_audit_logs_created_at',
    ];
    for (const idx of requiredIndexes) {
      assert.ok(indexes.includes(idx), `Missing index: ${idx}`);
      assert.ok(indexes.includes(`COMMENT ON INDEX ${idx}`), `Missing comment on ${idx}`);
    }
  });
});
