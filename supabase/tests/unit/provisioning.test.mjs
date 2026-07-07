/**
 * RetailX V2 Sprint E1 — Provisioning unit tests (milestone B SQL)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectRoot } from '../../../scripts/infrastructure/lib/helpers.mjs';

describe('Sprint E1 provisioning files', () => {
  const root = getProjectRoot();

  it('provision_shop migration exists', () => {
    const path = join(root, 'supabase/migrations/20260708140000_provision_shop.sql');
    assert.ok(existsSync(path));
    const sql = readFileSync(path, 'utf8');
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS public.provisioning_requests'));
    assert.ok(sql.includes('CREATE OR REPLACE FUNCTION public.provision_shop'));
    assert.ok(sql.includes('DROP FUNCTION IF EXISTS public.provision_shop_stub'));
  });

  it('provisioning TypeScript module exists', () => {
    assert.ok(existsSync(join(root, 'src/lib/provisioning/ProvisioningService.ts')));
    assert.ok(existsSync(join(root, 'src/lib/provisioning/provision-orchestrator.ts')));
  });

  it('provision-shop edge function exists', () => {
    assert.ok(existsSync(join(root, 'supabase/functions/provision-shop/index.ts')));
  });

  it('database.ts routes to V2 when flag enabled', () => {
    const db = readFileSync(join(root, 'src/lib/database.ts'), 'utf8');
    assert.ok(db.includes('shouldUseV2Provisioning'));
    assert.ok(db.includes('addShopV2'));
  });
});
