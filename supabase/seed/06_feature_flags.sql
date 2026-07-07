-- Seed: feature flags (idempotent)
-- RetailX V2 Milestone A
-- All V2 paths default to false for safe rollout

INSERT INTO public.feature_flags (key, enabled, description, environments)
VALUES
  (
    'USE_V2_PROVISIONING',
    false,
    'Use V2 provision_shop RPC instead of legacy addShop flow',
    '{"development": false, "staging": false, "production": false}'::jsonb
  ),
  (
    'USE_MEMBERSHIP_AUTH',
    false,
    'Use membership-based auth instead of legacy user_profiles',
    '{"development": false, "staging": false, "production": false}'::jsonb
  ),
  (
    'USE_MEMBERSHIP_RLS',
    false,
    'Enforce RLS via memberships table instead of shop_id on profiles',
    '{"development": false, "staging": false, "production": false}'::jsonb
  ),
  (
    'WRITE_LEGACY_CREDENTIALS',
    true,
    'Continue writing shops.username/password during provisioning (V1 compat)',
    '{"development": true, "staging": true, "production": true}'::jsonb
  ),
  (
    'USE_V2_CHECKOUT',
    false,
    'Use complete_sale RPC for checkout (future milestone)',
    '{"development": false, "staging": false, "production": false}'::jsonb
  ),
  (
    'ENABLE_EDGE_FUNCTIONS',
    false,
    'Route admin operations through Edge Functions',
    '{"development": false, "staging": false, "production": false}'::jsonb
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  environments = EXCLUDED.environments,
  updated_at = now();
-- Note: enabled column is NOT overwritten on conflict — allows runtime toggles to persist
