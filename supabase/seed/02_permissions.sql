-- Seed: permissions (idempotent)
-- RetailX V2 Milestone A

INSERT INTO public.permissions (code, description, context)
VALUES
  -- Platform
  ('platform.admin', 'Full platform administration', 'platform'),
  ('platform.support.read', 'Read support data across shops', 'platform'),
  ('platform.migrations.run', 'Run database migrations', 'platform'),
  -- Shop management
  ('shop.read', 'View shop data', 'shop'),
  ('shop.update', 'Update shop settings', 'shop'),
  ('shop.users.manage', 'Manage shop users and invitations', 'shop'),
  ('shop.branches.manage', 'Manage branches', 'shop'),
  -- Catalog
  ('catalog.products.read', 'View products', 'shop'),
  ('catalog.products.write', 'Create and update products', 'shop'),
  ('catalog.categories.manage', 'Manage categories', 'shop'),
  -- Inventory
  ('inventory.read', 'View stock levels', 'shop'),
  ('inventory.adjust', 'Adjust inventory', 'shop'),
  ('inventory.wastage', 'Record wastage', 'shop'),
  -- Sales
  ('sales.checkout', 'Process sales at POS', 'shop'),
  ('sales.refund', 'Process refunds', 'shop'),
  ('sales.reports', 'View sales reports', 'shop'),
  -- Billing
  ('billing.read', 'View subscription and invoices', 'shop'),
  ('billing.manage', 'Manage subscription', 'shop')
ON CONFLICT (code) DO UPDATE SET
  description = EXCLUDED.description,
  context = EXCLUDED.context;
