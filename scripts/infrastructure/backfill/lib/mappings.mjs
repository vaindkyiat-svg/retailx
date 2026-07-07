/**
 * RetailX V2 Milestone C1 — V1 role → V2 system_role slug mapping
 */

export const V1_ROLE_TO_V2_SLUG = {
  shop_owner: 'shop_owner',
  admin: 'platform_admin',
};

export const DEFAULT_PLAN_CODE = 'starter';

/**
 * Map V1 shops.plan TEXT to V2 plans.code
 */
export function mapLegacyPlanToCode(legacyPlan) {
  const normalized = (legacyPlan ?? 'standard').toLowerCase().trim();
  const mapping = {
    free: 'free',
    starter: 'starter',
    standard: 'starter',
    growth: 'growth',
    enterprise: 'enterprise',
    basic: 'starter',
    pro: 'growth',
    premium: 'growth',
  };
  return mapping[normalized] ?? DEFAULT_PLAN_CODE;
}

export const DEFAULT_SHOP_SETTINGS = [
  { key: 'pos.currency_default', value: 'INR' },
  { key: 'pos.tax_rate_default', value: 0 },
  { key: 'pos.receipt_footer', value: '' },
  { key: 'onboarding.completed', value: false },
  { key: 'legacy.plan_source', value: 'v1_shops.plan' },
];

export const BACKFILL_BRANCH_CODE = 'MAIN';
export const BACKFILL_BRANCH_NAME = 'Main';
export const BACKFILL_WAREHOUSE_CODE = 'DEFAULT';
export const BACKFILL_WAREHOUSE_NAME = 'Default';
