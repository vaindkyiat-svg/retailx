-- Migration: 20260708210000_refunds_rls
-- Add tenant-scoped RLS policies on refunds (RLS was enabled with zero policies).

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop owners can access their refunds" ON public.refunds;
DROP POLICY IF EXISTS refunds_select ON public.refunds;
DROP POLICY IF EXISTS refunds_insert ON public.refunds;
DROP POLICY IF EXISTS refunds_update ON public.refunds;
DROP POLICY IF EXISTS refunds_delete ON public.refunds;

CREATE POLICY refunds_select ON public.refunds
  FOR SELECT
  TO authenticated
  USING (shop_id = public.get_user_shop_id());

CREATE POLICY refunds_insert ON public.refunds
  FOR INSERT
  TO authenticated
  WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY refunds_update ON public.refunds
  FOR UPDATE
  TO authenticated
  USING (shop_id = public.get_user_shop_id())
  WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY refunds_delete ON public.refunds
  FOR DELETE
  TO authenticated
  USING (shop_id = public.get_user_shop_id());

COMMENT ON POLICY refunds_insert ON public.refunds IS
  'Shop members can create refunds for their shop (user_profiles.shop_id).';
