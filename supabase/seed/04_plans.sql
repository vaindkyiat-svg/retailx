-- Seed: plans (idempotent)
-- RetailX V2 Milestone A

INSERT INTO public.plans (code, name, max_users, max_branches, max_products, features, price_monthly_paise, is_active)
VALUES
  (
    'free',
    'Free',
    2,
    1,
    50,
    '{"pos": true, "reports": false, "multi_branch": false}'::jsonb,
    0,
    true
  ),
  (
    'starter',
    'Starter',
    5,
    1,
    500,
    '{"pos": true, "reports": true, "multi_branch": false}'::jsonb,
    99900,
    true
  ),
  (
    'growth',
    'Growth',
    15,
    3,
    5000,
    '{"pos": true, "reports": true, "multi_branch": true, "inventory_advanced": true}'::jsonb,
    299900,
    true
  ),
  (
    'enterprise',
    'Enterprise',
    100,
    50,
    NULL,
    '{"pos": true, "reports": true, "multi_branch": true, "inventory_advanced": true, "api_access": true}'::jsonb,
    0,
    true
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  max_users = EXCLUDED.max_users,
  max_branches = EXCLUDED.max_branches,
  max_products = EXCLUDED.max_products,
  features = EXCLUDED.features,
  price_monthly_paise = EXCLUDED.price_monthly_paise,
  is_active = EXCLUDED.is_active,
  updated_at = now();
