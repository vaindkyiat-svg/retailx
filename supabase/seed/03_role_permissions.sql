-- Seed: role_permissions (idempotent)
-- RetailX V2 Milestone A

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.system_roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'platform_admin'
  AND p.code LIKE 'platform.%'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.system_roles r
JOIN public.permissions p ON p.code IN (
  'platform.support.read',
  'shop.read',
  'sales.reports'
)
WHERE r.slug = 'platform_support'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.system_roles r
JOIN public.permissions p ON p.context = 'shop'
WHERE r.slug = 'shop_owner'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.system_roles r
JOIN public.permissions p ON p.code IN (
  'shop.read', 'shop.update', 'shop.users.manage', 'shop.branches.manage',
  'catalog.products.read', 'catalog.products.write', 'catalog.categories.manage',
  'inventory.read', 'inventory.adjust', 'inventory.wastage',
  'sales.checkout', 'sales.refund', 'sales.reports',
  'billing.read'
)
WHERE r.slug = 'shop_manager'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.system_roles r
JOIN public.permissions p ON p.code IN (
  'shop.read',
  'catalog.products.read',
  'inventory.read',
  'sales.checkout',
  'sales.reports'
)
WHERE r.slug = 'shop_cashier'
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.system_roles r
JOIN public.permissions p ON p.code IN (
  'shop.read',
  'catalog.products.read',
  'inventory.read',
  'sales.reports'
)
WHERE r.slug = 'shop_viewer'
ON CONFLICT (role_id, permission_id) DO NOTHING;
