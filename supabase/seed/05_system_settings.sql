-- Seed: system settings (idempotent)
-- RetailX V2 Milestone A

INSERT INTO public.platform_settings (key, value, category, description, is_public)
VALUES
  (
    'app.name',
    '"RetailX POS"'::jsonb,
    'general',
    'Application display name',
    true
  ),
  (
    'app.version',
    '"2.0.0-milestone-a"'::jsonb,
    'general',
    'Current platform version',
    true
  ),
  (
    'maintenance.enabled',
    'false'::jsonb,
    'operations',
    'Global maintenance mode',
    true
  ),
  (
    'maintenance.message',
    '"Scheduled maintenance in progress."'::jsonb,
    'operations',
    'Message shown during maintenance',
    true
  ),
  (
    'auth.legacy_credentials_enabled',
    'true'::jsonb,
    'auth',
    'Allow legacy shop username/password login (V1 compat)',
    false
  ),
  (
    'provisioning.default_plan',
    '"starter"'::jsonb,
    'provisioning',
    'Default plan code for new shops',
    false
  ),
  (
    'pos.currency_default',
    '"INR"'::jsonb,
    'pos',
    'Default currency code',
    true
  ),
  (
    'pos.tax_rate_default',
    '0'::jsonb,
    'pos',
    'Default tax rate percentage',
    true
  )
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  is_public = EXCLUDED.is_public,
  updated_at = now();
