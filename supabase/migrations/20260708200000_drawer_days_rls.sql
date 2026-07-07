-- Migration: 20260708200000_drawer_days_rls
-- Sprint: Fix Drawer RLS — add tenant-scoped policies on drawer_days
--
-- drawer_transactions already has drawer_select/insert/update/delete via get_user_shop_id().
-- drawer_days had RLS enabled but zero policies, blocking checkout (42501 on INSERT).

ALTER TABLE public.drawer_days ENABLE ROW LEVEL SECURITY;

-- Drop legacy policy names if present (idempotent)
DROP POLICY IF EXISTS "Shop owners can access their drawer days" ON public.drawer_days;
DROP POLICY IF EXISTS "Shop owners can insert their drawer days" ON public.drawer_days;
DROP POLICY IF EXISTS "Shop owners can update their drawer days" ON public.drawer_days;
DROP POLICY IF EXISTS "Shop owners can delete their drawer days" ON public.drawer_days;
DROP POLICY IF EXISTS drawer_days_select ON public.drawer_days;
DROP POLICY IF EXISTS drawer_days_insert ON public.drawer_days;
DROP POLICY IF EXISTS drawer_days_update ON public.drawer_days;
DROP POLICY IF EXISTS drawer_days_delete ON public.drawer_days;

-- Match orders / drawer_transactions tenant model:
-- shop_id must equal the authenticated user's user_profiles.shop_id
CREATE POLICY drawer_days_select ON public.drawer_days
  FOR SELECT
  TO authenticated
  USING (shop_id = public.get_user_shop_id());

CREATE POLICY drawer_days_insert ON public.drawer_days
  FOR INSERT
  TO authenticated
  WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY drawer_days_update ON public.drawer_days
  FOR UPDATE
  TO authenticated
  USING (shop_id = public.get_user_shop_id())
  WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY drawer_days_delete ON public.drawer_days
  FOR DELETE
  TO authenticated
  USING (shop_id = public.get_user_shop_id());

COMMENT ON POLICY drawer_days_select ON public.drawer_days IS
  'Shop members can read drawer days for their shop (user_profiles.shop_id).';
COMMENT ON POLICY drawer_days_insert ON public.drawer_days IS
  'Shop members can create drawer days for their shop (user_profiles.shop_id).';
