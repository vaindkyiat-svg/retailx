/**
 * RetailX V2 Sprint E2 — Post-provision and golden path assertions
 */

export async function verifyProvisionedEntities(serviceClient, ctx) {
  const { shopId, ownerUserId, membershipId, branchId, warehouseId, subscriptionId } = ctx;
  const validations = {};

  const shop = await serviceClient.from('shops').select('id').eq('id', shopId).maybeSingle();
  validations.shop = { ok: !!shop.data?.id, detail: shop.error?.message ?? null };

  const membership = await serviceClient
    .from('memberships')
    .select('id, user_id, role_id, system_roles(slug)')
    .eq('id', membershipId)
    .maybeSingle();
  validations.membership = { ok: !!membership.data?.id, detail: membership.error?.message ?? null };

  const hasOwnerRole = membership.data?.system_roles?.slug === 'shop_owner';
  validations.ownerRole = { ok: hasOwnerRole, detail: membership.error?.message ?? null };

  const profile = await serviceClient
    .from('user_profiles')
    .select('id, shop_id, role')
    .eq('id', ownerUserId)
    .maybeSingle();
  validations.authUser = {
    ok: !!profile.data?.id && profile.data.shop_id === shopId,
    detail: profile.error?.message ?? null,
  };

  const branch = await serviceClient.from('branches').select('id').eq('id', branchId).maybeSingle();
  validations.branch = { ok: !!branch.data?.id, detail: branch.error?.message ?? null };

  const warehouse = await serviceClient
    .from('warehouses')
    .select('id')
    .eq('id', warehouseId)
    .maybeSingle();
  validations.warehouse = { ok: !!warehouse.data?.id, detail: warehouse.error?.message ?? null };

  const settings = await serviceClient
    .from('shop_settings')
    .select('shop_id')
    .eq('shop_id', shopId)
    .limit(1);
  validations.settings = {
    ok: (settings.data?.length ?? 0) > 0,
    detail: settings.error?.message ?? null,
  };

  const subscription = await serviceClient
    .from('subscriptions')
    .select('id')
    .eq('id', subscriptionId)
    .maybeSingle();
  validations.subscription = { ok: !!subscription.data?.id, detail: subscription.error?.message ?? null };

  return validations;
}

export async function verifyCatalogAndSale(ownerClient, ctx) {
  const { shopId, productId, batchId, orderId, initialBatchQty, soldQty } = ctx;
  const validations = {};

  const product = await ownerClient
    .from('products')
    .select('id, name, category')
    .eq('id', productId)
    .eq('shop_id', shopId)
    .maybeSingle();
  validations.product = { ok: !!product.data?.id, detail: product.error?.message ?? null };

  const batch = await ownerClient
    .from('batches')
    .select('id, quantity')
    .eq('id', batchId)
    .eq('shop_id', shopId)
    .maybeSingle();
  const expectedQty = initialBatchQty - soldQty;
  validations.batch = {
    ok: !!batch.data?.id && Number(batch.data.quantity) === expectedQty,
    detail: batch.data
      ? `qty=${batch.data.quantity}, expected=${expectedQty}`
      : batch.error?.message ?? null,
  };
  validations.inventory = validations.batch;

  const order = await ownerClient
    .from('orders')
    .select('id, total, status')
    .eq('id', orderId)
    .eq('shop_id', shopId)
    .maybeSingle();
  validations.order = { ok: !!order.data?.id, detail: order.error?.message ?? null };

  const orders = await ownerClient
    .from('orders')
    .select('id, total')
    .eq('shop_id', shopId);
  const totalSales = (orders.data ?? []).reduce((sum, o) => sum + Number(o.total || 0), 0);
  validations.reports = {
    ok: totalSales > 0 && (orders.data ?? []).some((o) => o.id === orderId),
    detail: `orderCount=${orders.data?.length ?? 0}, totalSales=${totalSales}`,
  };
  validations.history = validations.reports;

  return validations;
}

export function summarizeValidations(validations) {
  const entries = Object.entries(validations);
  const passed = entries.filter(([, v]) => v.ok).length;
  return {
    passed,
    total: entries.length,
    allPassed: passed === entries.length,
    items: validations,
  };
}
