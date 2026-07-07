/**
 * Admin shops RLS unit tests (no database required)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { listMigrationFiles, getProjectRoot } from '../../../scripts/infrastructure/lib/helpers.mjs';

describe('admin shops RLS migration', () => {
  const root = getProjectRoot();
  const migrationPath = join(root, 'supabase/migrations/20260708150000_admin_shops_rls.sql');
  const rollbackPath = join(
    root,
    'supabase/migrations/rollback/20260708150000_admin_shops_rls.sql'
  );

  it('migration file exists and uses is_platform_admin()', () => {
    assert.ok(existsSync(migrationPath));
    const sql = readFileSync(migrationPath, 'utf8');
    assert.ok(sql.includes('admins_manage_all_shops'));
    assert.ok(sql.includes('private.is_platform_admin()'));
    assert.ok(sql.includes('FOR ALL'));
    assert.ok(sql.includes('TO authenticated'));
  });

  it('rollback drops admins_manage_all_shops policy', () => {
    assert.ok(existsSync(rollbackPath));
    const sql = readFileSync(rollbackPath, 'utf8');
    assert.ok(sql.includes('DROP POLICY IF EXISTS admins_manage_all_shops'));
  });

  it('is included in ordered migration list', () => {
    const files = listMigrationFiles();
    const match = files.find((f) => f.version === '20260708150000');
    assert.ok(match, '20260708150000_admin_shops_rls.sql must be registered');
    assert.equal(match.name, 'admin_shops_rls');
  });
});

describe('fetchShops error surfacing', () => {
  it('throws ShopFetchError instead of returning empty array on query failure', () => {
    const databaseTs = readFileSync(join(getProjectRoot(), 'src/lib/database.ts'), 'utf8');
    assert.ok(databaseTs.includes('export class ShopFetchError'));
    const fetchShopsMatch = databaseTs.match(
      /export async function fetchShops\(\)[\s\S]*?(?=\nexport async function|\n\/\/ ───)/
    );
    assert.ok(fetchShopsMatch, 'fetchShops function not found');
    const fetchShopsFn = fetchShopsMatch[0];
    assert.ok(fetchShopsFn.includes('throw new ShopFetchError'));
    assert.ok(!fetchShopsFn.includes('return []'));
  });

  it('App.tsx surfaces shopsLoadError to AdminPanel', () => {
    const appTsx = readFileSync(join(getProjectRoot(), 'src/app/App.tsx'), 'utf8');
    assert.ok(appTsx.includes('shopsLoadError'));
    assert.ok(appTsx.includes('ShopFetchError'));
    assert.ok(appTsx.includes('Failed to load shops'));
  });
});
