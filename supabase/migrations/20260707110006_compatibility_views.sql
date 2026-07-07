-- Migration: 20260707110006_compatibility_views
-- RetailX V2 Milestone B — Views for V1 compatibility (read-only, non-breaking)

-- system_settings alias for platform_settings (approved architecture naming)
CREATE OR REPLACE VIEW public.system_settings AS
SELECT
  key,
  value,
  category,
  description,
  is_public,
  created_at,
  updated_at
FROM public.platform_settings;

COMMENT ON VIEW public.system_settings IS
  'Compatibility alias for platform_settings. V1 app does not query this view.';

-- V1 user_profiles enriched with V2 membership data (when present)
CREATE OR REPLACE VIEW public.v_user_shop_context AS
SELECT
  up.id AS user_id,
  up.email,
  up.full_name,
  up.role AS legacy_role,
  up.shop_id,
  m.id AS membership_id,
  m.role_id,
  sr.slug AS v2_role_slug,
  sr.name AS v2_role_name,
  m.status AS membership_status,
  m.is_primary,
  s.name AS shop_name,
  s.status AS shop_status
FROM public.user_profiles up
JOIN public.shops s ON s.id = up.shop_id
LEFT JOIN public.memberships m
  ON m.user_id = up.id
  AND m.shop_id = up.shop_id
  AND m.deleted_at IS NULL
LEFT JOIN public.system_roles sr ON sr.id = m.role_id;

COMMENT ON VIEW public.v_user_shop_context IS
  'Dual-read view joining V1 user_profiles with V2 memberships. For future auth migration only.';

-- Shop summary with V2 tenancy counts
CREATE OR REPLACE VIEW public.v_shop_tenancy_summary AS
SELECT
  s.id AS shop_id,
  s.name AS shop_name,
  s.status AS legacy_status,
  s.plan AS legacy_plan,
  sub.id AS subscription_id,
  sub.status AS subscription_status,
  p.code AS plan_code,
  p.name AS plan_name,
  (SELECT count(*)::int FROM public.memberships m
   WHERE m.shop_id = s.id AND m.status = 'active' AND m.deleted_at IS NULL) AS active_members,
  (SELECT count(*)::int FROM public.branches b
   WHERE b.shop_id = s.id AND b.deleted_at IS NULL) AS branch_count,
  (SELECT count(*)::int FROM public.warehouses w
   WHERE w.shop_id = s.id AND w.deleted_at IS NULL) AS warehouse_count
FROM public.shops s
LEFT JOIN public.subscriptions sub ON sub.shop_id = s.id
LEFT JOIN public.plans p ON p.id = sub.plan_id;

COMMENT ON VIEW public.v_shop_tenancy_summary IS
  'Admin dashboard summary. Not used by V1 POS app.';

-- Grant read on views to authenticated (RLS on underlying tables still applies)
GRANT SELECT ON public.system_settings TO authenticated;
GRANT SELECT ON public.v_user_shop_context TO authenticated;
GRANT SELECT ON public.v_shop_tenancy_summary TO authenticated;
