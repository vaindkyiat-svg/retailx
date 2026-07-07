-- Migration: 20260708150000_admin_shops_rls
-- Sprint E2 — Allow platform admins to list/manage all V1 shops (admin dashboard)

-- Uses private.is_platform_admin() which includes user_profiles.role = 'admin'
-- and platform membership roles (platform_admin, platform_support).

DROP POLICY IF EXISTS admins_manage_all_shops ON public.shops;

CREATE POLICY admins_manage_all_shops ON public.shops
  FOR ALL
  TO authenticated
  USING (private.is_platform_admin())
  WITH CHECK (private.is_platform_admin());

COMMENT ON POLICY admins_manage_all_shops ON public.shops IS
  'Platform admins can read and manage all shops for the admin console.';
