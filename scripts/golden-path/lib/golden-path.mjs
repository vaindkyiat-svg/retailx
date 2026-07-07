/**
 * RetailX V2 Sprint E2 — Golden path workflow runner
 */

import { randomUUID } from 'node:crypto';
import { createAnonClient, createServiceClient } from './clients.mjs';
import { provisionShop, uniqueShopInput } from './provisioning.mjs';
import { StepTracker } from './timing.mjs';
import { verifyProvisionedEntities, verifyCatalogAndSale, summarizeValidations } from './assertions.mjs';

function todayParts() {
  const now = new Date();
  return {
    date: now.toISOString().split('T')[0],
    time: now.toLocaleTimeString('en-GB', { hour12: false }),
  };
}

async function processOrderInventory(client, shopId, items) {
  for (const item of items) {
    let remainingQty = item.qty;
    const { data: batches, error } = await client
      .from('batches')
      .select('*')
      .eq('shop_id', shopId)
      .eq('product_id', item.id)
      .order('added_date', { ascending: true });

    if (error) throw new Error(`Batch fetch failed: ${error.message}`);

    for (const batch of batches ?? []) {
      if (remainingQty <= 0) break;
      if (batch.status === 'unsellable' || batch.status === 'expired') continue;

      const qtyToDeduct = Math.min(remainingQty, batch.quantity);
      const newQuantity = batch.quantity - qtyToDeduct;

      const { error: updateError } = await client
        .from('batches')
        .update({ quantity: newQuantity })
        .eq('id', batch.id)
        .eq('shop_id', shopId);

      if (updateError) throw new Error(`Batch update failed: ${updateError.message}`);
      remainingQty -= qtyToDeduct;
    }

    if (remainingQty > 0) {
      throw new Error(`Insufficient inventory for product ${item.id}: short by ${remainingQty}`);
    }
  }
}

function computeSalesSummary(orders) {
  const today = new Date().toISOString().split('T')[0];
  const todayOrders = (orders ?? []).filter((o) => o.date === today);
  return {
    totalOrders: orders?.length ?? 0,
    todayOrders: todayOrders.length,
    totalRevenue: (orders ?? []).reduce((s, o) => s + Number(o.total || 0), 0),
    todayRevenue: todayOrders.reduce((s, o) => s + Number(o.total || 0), 0),
  };
}

/**
 * Run the complete golden path against live Supabase
 * @param {ReturnType<import('./env.mjs').loadEnv>} env
 */
export async function runGoldenPath(env) {
  const tracker = new StepTracker();
  const serviceClient = createServiceClient(env);
  const anonClient = createAnonClient(env);

  /** @type {Record<string, unknown>} */
  const context = {};
  /** @type {string[]} */
  const knownIssues = [];
  let fatalError = null;
  /** @type {ReturnType<createAnonClient>|null} */
  let ownerClient = null;

  try {
  await tracker.run(
    '1. Admin logs in',
    async () => {
      const { data, error } = await anonClient.auth.signInWithPassword({
        email: env.adminEmail,
        password: env.adminPassword,
      });

      if (error) {
        knownIssues.push(
          'Admin user not found — run create_admin.mjs. Provisioning continues via service role.'
        );
        return null;
      }

      context.adminUserId = data.user?.id;
      await anonClient.auth.signOut();
      return data.user;
    },
    'Ensure admin exists: node create_admin.mjs'
  );

  // Step 2-3: Admin creates shop / provisioning succeeds
  const shopInput = uniqueShopInput('GoldenPath');
  const provisionResult = await tracker.run(
    '2-3. Admin creates shop (V2 provisioning)',
    async () => {
      const result = await provisionShop(serviceClient, shopInput);
      Object.assign(context, result);
      return result;
    },
    'Deploy provision_shop migration and ensure USE_V2_PROVISIONING path is tested'
  );

  // Step 4: Owner receives credentials
  await tracker.run(
    '4. Owner receives temporary password',
    async () => {
      if (!provisionResult.temporaryPassword) {
        throw new Error('No temporary password returned from provisioning');
      }
      context.ownerPassword = provisionResult.temporaryPassword;
      return { email: provisionResult.ownerEmail, password: '***' };
    },
    null
  );

  // Step 5-6: Owner logs in + tenant loaded
  ownerClient = createAnonClient(env);
  await tracker.run(
    '5-6. Owner logs in with correct tenant',
    async () => {
      const { data, error } = await ownerClient.auth.signInWithPassword({
        email: provisionResult.ownerEmail,
        password: provisionResult.temporaryPassword,
      });
      if (error) throw new Error(`Owner login failed: ${error.message}`);

      const { data: profile, error: profileErr } = await ownerClient
        .from('user_profiles')
        .select('shop_id, role, full_name')
        .eq('id', data.user.id)
        .single();

      if (profileErr) throw new Error(`Profile load failed: ${profileErr.message}`);
      if (profile.shop_id !== provisionResult.shopId) {
        throw new Error(
          `Tenant mismatch: profile.shop_id=${profile.shop_id}, expected=${provisionResult.shopId}`
        );
      }

      context.ownerUserId = data.user.id;
      context.shopId = profile.shop_id;
      return profile;
    },
    'Verify user_profiles.shop_id matches provisioned shop'
  );

  // Step 7: Dashboard load
  await tracker.run(
    '7. Dashboard data load',
    async () => {
      const shopId = context.shopId;
      const [products, batches, orders, drawer] = await Promise.all([
        ownerClient.from('products').select('id').eq('shop_id', shopId),
        ownerClient.from('batches').select('id').eq('shop_id', shopId),
        ownerClient.from('orders').select('id, total, date').eq('shop_id', shopId),
        ownerClient.from('drawer_days').select('id').eq('shop_id', shopId),
      ]);

      for (const [name, res] of [
        ['products', products],
        ['batches', batches],
        ['orders', orders],
        ['drawer_days', drawer],
      ]) {
        if (res.error) throw new Error(`Dashboard ${name} fetch failed: ${res.error.message}`);
      }

      context.dashboardSummary = {
        products: products.data?.length ?? 0,
        batches: batches.data?.length ?? 0,
        orders: orders.data?.length ?? 0,
      };
      return context.dashboardSummary;
    },
    null
  );

  // Step 8-9: Category + Product (category is string on product)
  const category = 'Sweets';
  let productId;
  await tracker.run(
    '8-9. Add category and product',
    async () => {
      const { data, error } = await ownerClient
        .from('products')
        .insert([
          {
            shop_id: context.shopId,
            name: 'Golden Path Ladoo',
            namehi: 'लड्डू',
            category,
            price: 120,
            unit: 'kg',
            stock: 0,
            emoji: '🍬',
            low_stock_threshold: 5,
          },
        ])
        .select();

      if (error) throw new Error(`Product insert failed: ${error.message}`);
      productId = data[0].id;
      context.productId = productId;
      context.category = category;
      return data[0];
    },
    'Categories are product.category strings — no separate categories table'
  );

  // Step 10: Add batch
  let batchId;
  const initialBatchQty = 50;
  await tracker.run(
    '10. Add batch',
    async () => {
      const { date } = todayParts();
      const { data, error } = await ownerClient
        .from('batches')
        .insert([
          {
            shop_id: context.shopId,
            product_id: productId,
            batch_no: `GP-${randomUUID().slice(0, 6)}`,
            mfg_date: date,
            expiry_date: new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0],
            quantity: initialBatchQty,
            cost_price: 80,
            added_date: date,
            status: 'active',
            manual_unsellable: false,
            notes: 'Golden path test batch',
          },
        ])
        .select();

      if (error) throw new Error(`Batch insert failed: ${error.message}`);
      batchId = data[0].id;
      context.batchId = batchId;
      context.initialBatchQty = initialBatchQty;
      return data[0];
    },
    null
  );

  // Step 11: Verify inventory
  await tracker.run(
    '11. Verify inventory updated',
    async () => {
      const { data, error } = await ownerClient
        .from('batches')
        .select('quantity')
        .eq('id', batchId)
        .single();
      if (error) throw new Error(error.message);
      if (Number(data.quantity) !== initialBatchQty) {
        throw new Error(`Expected qty ${initialBatchQty}, got ${data.quantity}`);
      }
      return data;
    },
    null
  );

  // Step 12-16: Checkout flow
  const soldQty = 2;
  const unitPrice = 120;
  let orderId;
  await tracker.run(
    '12-16. Checkout, order saved, inventory reduced',
    async () => {
      const { date, time } = todayParts();
      orderId = `GP-${Date.now()}`;
      const items = [{ id: productId, name: 'Golden Path Ladoo', price: unitPrice, qty: soldQty }];

      const order = {
        id: orderId,
        shop_id: context.shopId,
        date,
        time,
        customer_name: 'Golden Path Customer',
        items_data: items,
        subtotal: unitPrice * soldQty,
        discount_type: 'percent',
        discount_value: 0,
        discount_amount: 0,
        total: unitPrice * soldQty,
        payment_mode: 'Cash',
        status: 'Completed',
      };

      const { data: orderData, error: orderErr } = await ownerClient
        .from('orders')
        .insert([order])
        .select();
      if (orderErr) throw new Error(`Order insert failed: ${orderErr.message}`);

      await processOrderInventory(ownerClient, context.shopId, items);

      // Drawer transaction (optional — may fail RLS)
      const { data: drawerDay } = await ownerClient
        .from('drawer_days')
        .select('id')
        .eq('shop_id', context.shopId)
        .eq('date', date)
        .maybeSingle();

      let drawerDayId = drawerDay?.id;
      if (!drawerDayId) {
        const { data: created } = await ownerClient
          .from('drawer_days')
          .insert([{ shop_id: context.shopId, date, opening_balance: 0, transactions: [] }])
          .select();
        drawerDayId = created?.[0]?.id;
      }

      if (drawerDayId) {
        const { error: txErr } = await ownerClient.from('drawer_transactions').insert([
          {
            shop_id: context.shopId,
            drawer_day_id: drawerDayId,
            date,
            time,
            type: 'sale',
            description: `Golden path sale ${orderId}`,
            amount: unitPrice * soldQty,
            balance: null,
          },
        ]);
        if (txErr) {
          knownIssues.push(`Drawer transaction insert failed (RLS): ${txErr.message}`);
        }
      } else {
        knownIssues.push('Drawer day not created — checkout sale recorded but drawer tx skipped');
      }

      context.orderId = orderId;
      context.soldQty = soldQty;
      return orderData[0];
    },
    'If order insert fails with 42501, apply RLS fix from RLS_FIX_INSTRUCTIONS.md'
  );

  // Step 14: Print bill (simulated)
  await tracker.run(
    '14. Print bill (simulated)',
    async () => {
      const { data, error } = await ownerClient
        .from('orders')
        .select('id, items_data, total, customer_name, payment_mode')
        .eq('id', orderId)
        .single();
      if (error) throw new Error(error.message);
      const bill = {
        orderId: data.id,
        customer: data.customer_name,
        total: data.total,
        payment: data.payment_mode,
        itemCount: Array.isArray(data.items_data) ? data.items_data.length : 0,
      };
      context.bill = bill;
      return bill;
    },
    'Physical print not tested — bill data verified from order record'
  );

  // Step 17-18: Reports and history
  await tracker.run(
    '17-18. Sales report and order history updated',
    async () => {
      const { data: orders, error } = await ownerClient
        .from('orders')
        .select('id, total, date, status')
        .eq('shop_id', context.shopId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      const summary = computeSalesSummary(orders);
      if (!orders.some((o) => o.id === orderId)) {
        throw new Error('Order not found in history');
      }
      if (summary.totalRevenue < unitPrice * soldQty) {
        throw new Error('Sales total does not include checkout order');
      }

      context.salesSummary = summary;
      return summary;
    },
    null
  );

  // Step 19: Logout
  await tracker.run('19. Owner logout', async () => {
    const { error } = await ownerClient.auth.signOut();
    if (error) throw new Error(error.message);
    return true;
  });

  // Step 20-21: Re-login and persistence
  await tracker.run(
    '20-21. Re-login and verify data persists',
    async () => {
      const { error: loginErr } = await ownerClient.auth.signInWithPassword({
        email: provisionResult.ownerEmail,
        password: provisionResult.temporaryPassword,
      });
      if (loginErr) throw new Error(`Re-login failed: ${loginErr.message}`);

      const { data: product } = await ownerClient
        .from('products')
        .select('id')
        .eq('id', productId)
        .maybeSingle();
      const { data: order } = await ownerClient
        .from('orders')
        .select('id')
        .eq('id', orderId)
        .maybeSingle();
      const { data: batch } = await ownerClient
        .from('batches')
        .select('quantity')
        .eq('id', batchId)
        .maybeSingle();

      if (!product?.id) throw new Error('Product missing after re-login');
      if (!order?.id) throw new Error('Order missing after re-login');
      if (Number(batch?.quantity) !== initialBatchQty - soldQty) {
        throw new Error('Batch quantity not persisted correctly');
      }

      return { product: product.id, order: order.id, batchQty: batch.quantity };
    },
    null
  );

  } catch (err) {
    fatalError = err instanceof Error ? err.message : String(err);
  }

  let provisionValidations = {};
  let catalogValidations = {};
  if (context.shopId && context.membershipId) {
    try {
      provisionValidations = await verifyProvisionedEntities(serviceClient, context);
    } catch {
      // partial validation only
    }
  }
  if (context.productId && context.orderId && ownerClient) {
    try {
      catalogValidations = await verifyCatalogAndSale(ownerClient, {
        shopId: context.shopId,
        productId: context.productId,
        batchId: context.batchId,
        orderId: context.orderId,
        initialBatchQty: context.initialBatchQty,
        soldQty: context.soldQty,
      });
    } catch {
      // partial validation only
    }
  }

  const allValidations = summarizeValidations({
    ...provisionValidations,
    ...catalogValidations,
  });

  const failedSteps = tracker.steps.filter((s) => s.result === 'fail');
  const overallResult = fatalError || failedSteps.length > 0
    ? failedSteps.length > 0 && !fatalError && allValidations.allPassed
      ? 'partial'
      : 'fail'
    : allValidations.allPassed
      ? 'pass'
      : 'partial';

  if (fatalError) knownIssues.push(fatalError);

  return {
    overallResult,
    steps: tracker.steps,
    performance: tracker.getPerformance(),
    context: {
      shopId: context.shopId,
      ownerEmail: context.ownerEmail,
      orderId: context.orderId,
      productId: context.productId,
      batchId: context.batchId,
    },
    validations: allValidations,
    knownIssues,
  };
}
