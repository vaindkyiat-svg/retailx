-- Seed: roles (idempotent)
-- RetailX V2 Milestone A

INSERT INTO public.system_roles (slug, name, scope, is_system)
VALUES
  ('platform_admin', 'Platform Administrator', 'platform', true),
  ('platform_support', 'Platform Support', 'platform', true),
  ('shop_owner', 'Shop Owner', 'shop', true),
  ('shop_manager', 'Shop Manager', 'shop', true),
  ('shop_cashier', 'Shop Cashier', 'shop', true),
  ('shop_viewer', 'Shop Viewer', 'shop', true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  scope = EXCLUDED.scope,
  is_system = EXCLUDED.is_system;
