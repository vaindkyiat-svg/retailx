/**
 * RetailX V2 Sprint E2 — Negative test scenarios
 */

import { randomUUID } from 'node:crypto';
import { createAnonClient, createServiceClient } from './clients.mjs';
import { provisionShop, uniqueShopInput } from './provisioning.mjs';

/**
 * @param {ReturnType<import('./env.mjs').loadEnv>} env
 */
export async function runNegativeTests(env) {
  const serviceClient = createServiceClient(env);
  const anonClient = createAnonClient(env);
  /** @type {import('./report.mjs').NegativeTestResult[]} */
  const results = [];

  /** @type {{ email: string, password: string, shopId: string }|null} */
  let ownerCreds = null;

  async function record(name, fn, expectFailure = true) {
    const start = Date.now();
    try {
      await fn();
      results.push({
        name,
        result: expectFailure ? 'fail' : 'pass',
        durationMs: Date.now() - start,
        errors: expectFailure ? ['Expected failure but operation succeeded'] : [],
        warnings: [],
        recommendation: expectFailure ? 'Negative test should have rejected the operation' : null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const infra = /fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(msg);
      results.push({
        name,
        result: infra ? 'skip' : expectFailure ? 'pass' : 'fail',
        durationMs: Date.now() - start,
        errors: infra ? [] : expectFailure ? [] : [msg],
        warnings: infra ? [`Skipped — Supabase unreachable: ${msg}`] : expectFailure ? [msg] : [],
        recommendation: infra ? 'Set valid VITE_SUPABASE_URL and ensure network access' : null,
      });
    }
  }

  // Duplicate email
  const dupInput = uniqueShopInput('DupEmail');
  await record('Duplicate email rejected', async () => {
    const first = await provisionShop(serviceClient, dupInput);
    ownerCreds = {
      email: first.ownerEmail,
      password: first.temporaryPassword,
      shopId: first.shopId,
    };
    await provisionShop(serviceClient, {
      ...uniqueShopInput('DupEmailOther'),
      ownerEmail: dupInput.ownerEmail,
      idempotencyKey: `dup-email-${randomUUID()}`,
    });
  });

  // Duplicate shop name for same owner
  const shopDup = uniqueShopInput('DupShop');
  await record('Duplicate shop rejected', async () => {
    await provisionShop(serviceClient, shopDup);
    await provisionShop(serviceClient, {
      ...shopDup,
      idempotencyKey: `dup-shop-${randomUUID()}`,
    });
  });

  // Wrong password
  await record('Wrong password rejected', async () => {
    const email = ownerCreds?.email ?? shopDup.ownerEmail;
    const { error } = await anonClient.auth.signInWithPassword({
      email,
      password: 'wrong-password-xyz',
    });
    if (!error) throw new Error('Sign in should fail with wrong password');
    if (!/invalid|credentials|password/i.test(error.message)) {
      throw new Error(`Unexpected auth error: ${error.message}`);
    }
  });

  // Expired session
  await record('Expired session rejected', async () => {
    if (!ownerCreds) throw new Error('No owner credentials from prior tests');

    const sessionClient = createAnonClient(env);
    const login = await sessionClient.auth.signInWithPassword({
      email: ownerCreds.email,
      password: ownerCreds.password,
    });
    if (login.error) throw new Error(`Setup login failed: ${login.error.message}`);

    await sessionClient.auth.signOut();

    const { error } = await sessionClient
      .from('orders')
      .select('id')
      .eq('shop_id', ownerCreds.shopId)
      .limit(1);

    if (!error) {
      throw new Error('Unauthenticated client should not read tenant orders');
    }
  });

  // Invalid product checkout
  await record('Invalid product checkout handled', async () => {
    if (!ownerCreds) throw new Error('No owner credentials');

    const ownerClient = createAnonClient(env);
    const login = await ownerClient.auth.signInWithPassword({
      email: ownerCreds.email,
      password: ownerCreds.password,
    });
    if (login.error) throw login.error;

    const fakeProductId = 999999999;
    const { error } = await ownerClient.from('orders').insert([
      {
        id: `INVALID-${Date.now()}`,
        shop_id: ownerCreds.shopId,
        date: new Date().toISOString().split('T')[0],
        time: '12:00:00',
        customer_name: 'Test',
        items_data: [{ id: fakeProductId, name: 'Ghost', price: 10, qty: 1 }],
        subtotal: 10,
        discount_type: 'percent',
        discount_value: 0,
        discount_amount: 0,
        total: 10,
        payment_mode: 'Cash',
        status: 'Completed',
      },
    ]);

    if (!error) {
      throw new Error('Invalid product order inserted — inventory integrity risk');
    }
  });

  // Out-of-stock checkout
  await record('Out-of-stock checkout limited', async () => {
    const input = uniqueShopInput('OOS');
    const prov = await provisionShop(serviceClient, input);
    const ownerClient = createAnonClient(env);

    await ownerClient.auth.signInWithPassword({
      email: input.ownerEmail,
      password: prov.temporaryPassword,
    });

    const { data: product, error: pErr } = await ownerClient
      .from('products')
      .insert([
        {
          shop_id: prov.shopId,
          name: 'OOS Item',
          category: 'Sweets',
          price: 50,
          unit: 'pc',
          stock: 0,
        },
      ])
      .select()
      .single();
    if (pErr) throw pErr;

    await ownerClient.from('batches').insert([
      {
        shop_id: prov.shopId,
        product_id: product.id,
        batch_no: 'OOS-1',
        quantity: 1,
        cost_price: 30,
        added_date: new Date().toISOString().split('T')[0],
        status: 'active',
      },
    ]);

    const requestedQty = 5;
    let remaining = requestedQty;
    const { data: batches } = await ownerClient
      .from('batches')
      .select('*')
      .eq('product_id', product.id)
      .eq('shop_id', prov.shopId);

    for (const b of batches ?? []) {
      if (remaining <= 0) break;
      const deduct = Math.min(remaining, b.quantity);
      await ownerClient.from('batches').update({ quantity: b.quantity - deduct }).eq('id', b.id);
      remaining -= deduct;
    }

    if (remaining === 0) {
      throw new Error('Sold full requested qty despite insufficient stock');
    }
  });

  // Rollback after provisioning failure
  await record('Rollback after provisioning failure', async () => {
    const input = uniqueShopInput('Rollback');
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
      email: input.ownerEmail,
      password: 'rollback@test1',
      email_confirm: true,
    });
    if (authError) throw authError;
    const userId = authData.user.id;

    const { error } = await serviceClient.rpc('provision_shop', {
      p_idempotency_key: `rb-${randomUUID()}`,
      p_user_id: userId,
      p_owner_email: input.ownerEmail,
      p_owner_name: input.ownerName,
      p_owner_phone: input.phone,
      p_shop_name: '',
      p_plan_code: 'starter',
    });

    await serviceClient.auth.admin.deleteUser(userId);

    if (!error) {
      throw new Error('Expected provisioning to fail with empty shop name');
    }

    const { data: shops } = await serviceClient
      .from('shops')
      .select('id')
      .eq('owner_email', input.ownerEmail);

    if (shops?.length) {
      throw new Error('Shop row created despite failed provisioning');
    }
  });

  return results;
}
