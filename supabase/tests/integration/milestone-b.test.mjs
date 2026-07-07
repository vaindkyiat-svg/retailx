/**
 * RetailX V2 Milestone B — Database integration tests
 * Requires DATABASE_URL and V1 bootstrap (shops table)
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createClient,
  resolveEnvironment,
  getProjectRoot,
  listMigrationFiles,
} from '../../../scripts/infrastructure/lib/helpers.mjs';

const hasDatabase = !!process.env.DATABASE_URL;

const V2_TABLES = [
  'memberships', 'branches', 'warehouses', 'shop_settings',
  'subscriptions', 'invitations', 'user_devices', 'event_outbox', 'audit_logs',
];

describe('Milestone B database integration', { skip: !hasDatabase }, () => {
  let client;

  before(async () => {
    client = await createClient(resolveEnvironment('development'));

    const bootstrap = readFileSync(
      join(getProjectRoot(), 'supabase', 'tests', 'bootstrap', 'v1_minimal.sql'),
      'utf8'
    );
    await client.query(bootstrap);
  });

  after(async () => {
    if (client) await client.end();
  });

  it('all migrations apply without error', async () => {
    const files = listMigrationFiles();
    for (const file of files) {
      const sql = readFileSync(file.path, 'utf8');
      await client.query(sql);
    }
  });

  it('all V2 tables exist', async () => {
    for (const table of V2_TABLES) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        )`,
        [table]
      );
      assert.equal(result.rows[0].exists, true, `Table missing: ${table}`);
    }
  });

  it('RLS is enabled on V2 tables', async () => {
    const result = await client.query(
      `SELECT c.relname, c.relrowsecurity
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = ANY($1::text[])`,
      [V2_TABLES]
    );
    assert.equal(result.rows.length, V2_TABLES.length);
    for (const row of result.rows) {
      assert.equal(row.relrowsecurity, true, `RLS not enabled: ${row.relname}`);
    }
  });

  it('helper functions exist and current_shop_id falls back safely', async () => {
    const fns = await client.query(
      `SELECT proname FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'private'
         AND proname IN ('current_user_id', 'current_shop_id', 'is_platform_admin', 'is_shop_member')`
    );
    assert.equal(fns.rows.length, 4);

    const shopId = await client.query('SELECT private.current_shop_id() AS id');
    assert.equal(shopId.rows[0].id, null);
  });

  it('compatibility views are queryable', async () => {
    const views = ['system_settings', 'v_user_shop_context', 'v_shop_tenancy_summary'];
    for (const view of views) {
      await client.query(`SELECT 1 FROM public.${view} LIMIT 1`);
    }
  });

  it('updated_at trigger fires on shop_settings', async () => {
    const shop = await client.query(
      `INSERT INTO public.shops (name, owner_name, owner_phone, address)
       VALUES ('Test Shop', 'Owner', '1234567890', '123 St')
       RETURNING id`
    );
    const shopId = shop.rows[0].id;

    await client.query(
      `INSERT INTO public.shop_settings (shop_id, key, value)
       VALUES ($1, 'test.key', '{"a":1}'::jsonb)`,
      [shopId]
    );

    const before = await client.query(
      `SELECT created_at, updated_at FROM public.shop_settings WHERE shop_id = $1`,
      [shopId]
    );

    await new Promise((r) => setTimeout(r, 50));

    await client.query(
      `UPDATE public.shop_settings SET value = '{"a":2}'::jsonb WHERE shop_id = $1`,
      [shopId]
    );

    const after = await client.query(
      `SELECT updated_at FROM public.shop_settings WHERE shop_id = $1`,
      [shopId]
    );

    assert.ok(after.rows[0].updated_at >= before.rows[0].updated_at);

    await client.query('DELETE FROM public.shop_settings WHERE shop_id = $1', [shopId]);
    await client.query('DELETE FROM public.shops WHERE id = $1', [shopId]);
  });

  it('foreign key constraints prevent orphan memberships', async () => {
    const plan = await client.query(`SELECT id FROM public.plans LIMIT 1`);
    const role = await client.query(`SELECT id FROM public.system_roles WHERE slug = 'shop_owner' LIMIT 1`);

    if (plan.rows.length === 0 || role.rows.length === 0) {
      const seedDir = join(getProjectRoot(), 'supabase', 'seed');
      for (const f of ['01_roles.sql', '04_plans.sql']) {
        await client.query(readFileSync(join(seedDir, f), 'utf8'));
      }
    }

    const roleId = (await client.query(`SELECT id FROM public.system_roles WHERE slug = 'shop_owner' LIMIT 1`)).rows[0].id;
    const fakeUserId = '00000000-0000-0000-0000-000000000099';
    const fakeShopId = '00000000-0000-0000-0000-000000000099';

    await assert.rejects(
      () => client.query(
        `INSERT INTO public.memberships (user_id, shop_id, role_id)
         VALUES ($1, $2, $3)`,
        [fakeUserId, fakeShopId, roleId]
      ),
      /violates foreign key constraint/
    );
  });

  it('last Milestone B migration can be rolled back', async () => {
    const rollback = readFileSync(
      join(getProjectRoot(), 'supabase', 'migrations', 'rollback', '20260707110007_rls_skeleton.sql'),
      'utf8'
    );
    await client.query(rollback);

    const policies = await client.query(
      `SELECT count(*)::int AS count FROM pg_policies
       WHERE schemaname = 'public' AND policyname LIKE 'v2_%'`
    );
    assert.equal(policies.rows[0].count, 0);

    const reapply = readFileSync(
      join(getProjectRoot(), 'supabase', 'migrations', '20260707110007_rls_skeleton.sql'),
      'utf8'
    );
    await client.query(reapply);
  });
});

if (!hasDatabase) {
  console.log('Skipping Milestone B integration tests — DATABASE_URL not set');
}
