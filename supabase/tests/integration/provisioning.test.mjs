/**
 * RetailX V2 Sprint E1 — Provisioning integration tests
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

async function callProvision(client, params) {
  const result = await client.query(
    `SELECT public.provision_shop(
      $1, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19::uuid
    ) AS result`,
    [
      params.idempotencyKey,
      params.userId,
      params.email,
      params.ownerName,
      params.phone,
      params.shopName,
      params.address ?? null,
      params.city ?? null,
      params.state ?? null,
      params.gst ?? null,
      params.category ?? null,
      params.plan ?? 'starter',
      params.timezone ?? 'Asia/Kolkata',
      params.currency ?? 'INR',
      params.username ?? 'testuser',
      params.password ?? 'test@1234',
      params.writeLegacy ?? true,
      params.useInvitation ?? false,
      params.provisionedBy ?? null,
    ]
  );
  return result.rows[0].result;
}

describe('Sprint E1 provision_shop integration', { skip: !hasDatabase }, () => {
  let client;

  before(async () => {
    client = await createClient(resolveEnvironment('development'));
    const bootstrap = readFileSync(
      join(getProjectRoot(), 'supabase', 'tests', 'bootstrap', 'v1_minimal.sql'),
      'utf8'
    );
    await client.query(bootstrap);
    await applyAllMigrations(client);
    await applySeeds(client);
  });

  after(async () => {
    if (client) await client.end();
  });

  it('successful provisioning creates all entities', async () => {
    const userId = randomUUID();
    const email = `owner-${randomUUID().slice(0, 8)}@test.com`;
    const key = `test-${randomUUID()}`;

    const result = await callProvision(client, {
      idempotencyKey: key,
      userId,
      email,
      ownerName: 'Test Owner',
      phone: '9876543210',
      shopName: `Shop ${randomUUID().slice(0, 6)}`,
      city: 'Lucknow',
      state: 'UP',
    });

    assert.ok(result.shopId);
    assert.equal(result.ownerUserId, userId);
    assert.ok(result.membershipId);
    assert.ok(result.branchId);
    assert.ok(result.warehouseId);
    assert.ok(result.subscriptionId);

    const shop = await client.query(`SELECT id FROM public.shops WHERE id = $1`, [result.shopId]);
    assert.equal(shop.rowCount, 1);

    const membership = await client.query(
      `SELECT id FROM public.memberships WHERE shop_id = $1`,
      [result.shopId]
    );
    assert.equal(membership.rowCount, 1);
  });

  it('idempotent retry returns same result', async () => {
    const userId = randomUUID();
    const email = `retry-${randomUUID().slice(0, 8)}@test.com`;
    const key = `retry-${randomUUID()}`;
    const shopName = `Retry Shop ${randomUUID().slice(0, 4)}`;

    const first = await callProvision(client, {
      idempotencyKey: key,
      userId,
      email,
      ownerName: 'Retry Owner',
      phone: '9876543210',
      shopName,
    });

    const second = await callProvision(client, {
      idempotencyKey: key,
      userId,
      email,
      ownerName: 'Retry Owner',
      phone: '9876543210',
      shopName,
    });

    assert.equal(first.shopId, second.shopId);
  });

  it('duplicate email fails', async () => {
    const email = `dup-${randomUUID().slice(0, 8)}@test.com`;
    const shopName = `Dup ${randomUUID().slice(0, 4)}`;

    await callProvision(client, {
      idempotencyKey: `dup-a-${randomUUID()}`,
      userId: randomUUID(),
      email,
      ownerName: 'First',
      phone: '9876543210',
      shopName,
    });

    await assert.rejects(
      () =>
        callProvision(client, {
          idempotencyKey: `dup-b-${randomUUID()}`,
          userId: randomUUID(),
          email,
          ownerName: 'Second',
          phone: '9876543210',
          shopName: `Other ${randomUUID().slice(0, 4)}`,
        }),
      /EMAIL_ALREADY_EXISTS/
    );
  });

  it('duplicate shop name for same email fails', async () => {
    const email = `shopsame-${randomUUID().slice(0, 8)}@test.com`;
    const shopName = `Same Shop ${randomUUID().slice(0, 4)}`;

    await callProvision(client, {
      idempotencyKey: `shop-a-${randomUUID()}`,
      userId: randomUUID(),
      email,
      ownerName: 'Owner',
      phone: '9876543210',
      shopName,
    });

    await assert.rejects(
      () =>
        callProvision(client, {
          idempotencyKey: `shop-b-${randomUUID()}`,
          userId: randomUUID(),
          email,
          ownerName: 'Owner',
          phone: '9876543210',
          shopName,
        }),
      /SHOP_ALREADY_EXISTS/
    );
  });

  it('invalid plan fails when no active plan exists', async () => {
    await client.query(`UPDATE public.plans SET is_active = false`);

    await assert.rejects(
      () =>
        callProvision(client, {
          idempotencyKey: `plan-${randomUUID()}`,
          userId: randomUUID(),
          email: `plan-${randomUUID().slice(0, 8)}@test.com`,
          ownerName: 'Owner',
          phone: '9876543210',
          shopName: `Plan Shop ${randomUUID().slice(0, 4)}`,
          plan: 'starter',
        }),
      /INVALID_PLAN/
    );

    await client.query(readFileSync(join(getProjectRoot(), 'supabase', 'seed', '04_plans.sql'), 'utf8'));
  });

  it('transaction rollback on membership failure leaves no shop', async () => {
    const userId = randomUUID();
    const email = `rollback-${randomUUID().slice(0, 8)}@test.com`;
    const shopName = `Rollback ${randomUUID().slice(0, 4)}`;

    await client.query(`DELETE FROM public.system_roles WHERE slug = 'shop_owner'`);

    await assert.rejects(
      () =>
        callProvision(client, {
          idempotencyKey: `rb-${randomUUID()}`,
          userId,
          email,
          ownerName: 'Owner',
          phone: '9876543210',
          shopName,
        }),
      /PROVISION_FAILED|shop_owner role missing/
    );

    const shops = await client.query(
      `SELECT id FROM public.shops WHERE owner_email = $1 AND shop_name = $2`,
      [email, shopName]
    );
    assert.equal(shops.rowCount, 0);

    await client.query(readFileSync(join(getProjectRoot(), 'supabase', 'seed', '01_roles.sql'), 'utf8'));
  });
});
