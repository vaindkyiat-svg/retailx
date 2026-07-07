/**
 * RetailX V2 Sprint E1 — Post-provision business validation
 */

import { supabase } from '../supabase';
import type { BusinessValidationResult } from './types';

export async function validateProvisionedShop(shopId: string): Promise<BusinessValidationResult> {
  const checks: BusinessValidationResult['checks'] = [];

  const shop = await supabase.from('shops').select('id').eq('id', shopId).maybeSingle();
  checks.push({ name: 'shop_exists', passed: !!shop.data?.id, detail: shopId });

  const membership = await supabase
    .from('memberships')
    .select('id, role_id')
    .eq('shop_id', shopId)
    .eq('is_primary', true)
    .maybeSingle();
  checks.push({
    name: 'membership_exists',
    passed: !!membership.data?.id,
  });

  let ownerRoleOk = false;
  if (membership.data?.role_id) {
    const role = await supabase
      .from('system_roles')
      .select('slug')
      .eq('id', membership.data.role_id)
      .maybeSingle();
    ownerRoleOk = role.data?.slug === 'shop_owner';
  }
  checks.push({ name: 'owner_role', passed: ownerRoleOk });

  const branch = await supabase
    .from('branches')
    .select('id')
    .eq('shop_id', shopId)
    .eq('code', 'MAIN')
    .maybeSingle();
  checks.push({ name: 'branch_exists', passed: !!branch.data?.id });

  const warehouse = await supabase
    .from('warehouses')
    .select('id')
    .eq('shop_id', shopId)
    .eq('code', 'DEFAULT')
    .maybeSingle();
  checks.push({ name: 'warehouse_exists', passed: !!warehouse.data?.id });

  const settings = await supabase
    .from('shop_settings')
    .select('key')
    .eq('shop_id', shopId);
  checks.push({
    name: 'settings_exist',
    passed: (settings.data?.length ?? 0) >= 5,
    detail: `${settings.data?.length ?? 0} settings`,
  });

  const subscription = await supabase
    .from('subscriptions')
    .select('id')
    .eq('shop_id', shopId)
    .maybeSingle();
  checks.push({ name: 'subscription_exists', passed: !!subscription.data?.id });

  const profile = await supabase
    .from('user_profiles')
    .select('id')
    .eq('shop_id', shopId)
    .eq('role', 'shop_owner')
    .maybeSingle();
  checks.push({ name: 'auth_profile_exists', passed: !!profile.data?.id });

  const valid = checks.every((c) => c.passed);
  return { valid, checks };
}
