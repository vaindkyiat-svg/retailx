/**
 * Admin shops RLS regression tests — requires DATABASE_URL
 * Proves platform admins can list all shops after re-login while owners stay scoped.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  createClient,
  resolveEnvironment,
  getProjectRoot,
  listMigrationFiles,
  listSeedFiles,
} from '../../../scripts/infrastructure/lib/helpers.mjs';

const hasDatabase = !!process.env.DATABASE_URL;

const V1_SHOP_RLS = `
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop owners can access own shop by email" ON public.shops;
CREATE POLICY "Shop owners can access own shop by email" ON public.shops
  FOR SELECT, UPDATE, DELETE
  TO authenticated
  USING (owner_email = auth.email())
  WITH CHECK (owner_email = auth.email());

GRANT SELECT, UPDATE, DELETE ON public.shops TO authenticated;
GRANT SELECT ON public.user_profiles TO authenticated;
`;

const AUTH_STUBS = `
CREATE SCHEMA IF NOT EXISTS auth;

CREATE OR REPLACE FUNCTION auth.email()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.email', true), '');
$$;
`;

async function applyAllMigrations(client) {
  for (const file of listMigrationFiles()) {
    await client.query(readFileSync(file.path, 'utf8'));
  }
}

async function applySeeds(client) {
  for (const file of listSeedFiles()) {
    await client.query(readFileSync(file, 'utf8'));
  }
}

async function queryShopsAsUser(client, { userId, email }) {
  await client.query('BEGIN');
  try {
    await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [userId]);
    await client.query(`SELECT set_config('request.jwt.claim.email', $1, true)`, [email]);
    await client.query('SET LOCAL ROLE authenticated');
    const result = await client.query(
      `SELECT id, owner_email FROM public.shops ORDER BY created_at DESC`
    );
    await client.query('COMMIT');
    return result.rows;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
}

describe('shops RLS — admin dashboard regression', { skip: !hasDatabase }, () => {
  let client;
  let shopAId;
  let shopBId;
  let adminUserId;
  let ownerAUserId;
  let ownerBUserId;
  const adminEmail = `admin-${randomUUID().slice(0, 8)}@test.com`;
  const ownerAEmail = `owner-a-${randomUUID().slice(0, 8)}@test.com`;
  const ownerBEmail = `owner-b-${randomUUID().slice(0, 8)}@test.com`;

  before(async () => {
    client = await createClient(resolveEnvironment('development'));

    const bootstrap = readFileSync(
      join(getProjectRoot(), 'supabase', 'tests', 'bootstrap', 'v1_minimal.sql'),
      'utf8'
    );
    await client.query(bootstrap);
    await applyAllMigrations(client);
    await applySeeds(client);
    await client.query(AUTH_STUBS);
    await client.query(V1_SHOP_RLS);

    const adminAnchor = await client.query(
      `INSERT INTO public.shops (name, owner_name, owner_phone, address, owner_email, shop_name)
       VALUES ('Admin Anchor', 'Platform', '0000000000', 'HQ', $1, 'Admin Anchor')
       RETURNING id`,
      [adminEmail]
    );

    const shopA = await client.query(
      `INSERT INTO public.shops (name, owner_name, owner_phone, address, owner_email, shop_name)
       VALUES ('Shop Alpha', 'Owner A', '1111111111', '1 Alpha St', $1, 'Shop Alpha')
       RETURNING id`,
      [ownerAEmail]
    );
    shopAId = shopA.rows[0].id;

    const shopB = await client.query(
      `INSERT INTO public.shops (name, owner_name, owner_phone, address, owner_email, shop_name)
       VALUES ('Shop Beta', 'Owner B', '2222222222', '2 Beta St', $1, 'Shop Beta')
       RETURNING id`,
      [ownerBEmail]
    );
    shopBId = shopB.rows[0].id;

    adminUserId = randomUUID();
    ownerAUserId = randomUUID();
    ownerBUserId = randomUUID();

    await client.query(
      `INSERT INTO public.user_profiles (id, email, full_name, role, shop_id)
       VALUES ($1, $2, 'Platform Admin', 'admin', $3)`,
      [adminUserId, adminEmail, adminAnchor.rows[0].id]
    );
    await client.query(
      `INSERT INTO public.user_profiles (id, email, full_name, role, shop_id)
       VALUES ($1, $2, 'Owner A', 'shop_owner', $3)`,
      [ownerAUserId, ownerAEmail, shopAId]
    );
    await client.query(
      `INSERT INTO public.user_profiles (id, email, full_name, role, shop_id)
       VALUES ($1, $2, 'Owner B', 'shop_owner', $3)`,
      [ownerBUserId, ownerBEmail, shopBId]
    );
  });

  after(async () => {
    if (client) await client.end();
  });

  it('admins_manage_all_shops policy exists after migration', async () => {
    const result = await client.query(
      `SELECT 1 FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename = 'shops'
         AND policyname = 'admins_manage_all_shops'`
    );
    assert.equal(result.rowCount, 1);
  });

  it('admin sees all shops after re-login (fresh JWT session)', async () => {
    const firstLogin = await queryShopsAsUser(client, {
      userId: adminUserId,
      email: adminEmail,
    });
    const relogin = await queryShopsAsUser(client, {
      userId: adminUserId,
      email: adminEmail,
    });

    assert.ok(firstLogin.length >= 3, 'admin should see every shop row');
    assert.deepEqual(
      relogin.map((row) => row.id).sort(),
      firstLogin.map((row) => row.id).sort(),
      're-login must return the same shop set'
    );
    assert.ok(
      firstLogin.some((row) => row.id === shopAId) && firstLogin.some((row) => row.id === shopBId),
      'admin must see shops owned by other users'
    );
  });

  it('shop owners only see their own shop', async () => {
    const ownerAShops = await queryShopsAsUser(client, {
      userId: ownerAUserId,
      email: ownerAEmail,
    });
    const ownerBShops = await queryShopsAsUser(client, {
      userId: ownerBUserId,
      email: ownerBEmail,
    });

    assert.equal(ownerAShops.length, 1);
    assert.equal(ownerAShops[0].id, shopAId);
    assert.equal(ownerBShops.length, 1);
    assert.equal(ownerBShops[0].id, shopBId);
  });

  it('unauthorized users cannot read other shops', async () => {
    const ownerAShops = await queryShopsAsUser(client, {
      userId: ownerAUserId,
      email: ownerAEmail,
    });
    const strangerId = randomUUID();
    const strangerEmail = `stranger-${randomUUID().slice(0, 8)}@test.com`;

    const strangerShops = await queryShopsAsUser(client, {
      userId: strangerId,
      email: strangerEmail,
    });

    assert.ok(
      !ownerAShops.some((row) => row.id === shopBId),
      'owner A must not read shop B'
    );
    assert.equal(strangerShops.length, 0, 'user with no shop association sees no shops');
  });
});

if (!hasDatabase) {
  console.log('Skipping shops RLS integration tests — DATABASE_URL not set');
}
