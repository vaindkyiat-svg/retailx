-- Migration: 20260708220000_wastage_entries_rls
-- Add tenant-scoped RLS policies on wastage_entries (RLS was enabled with zero policies).

ALTER TABLE public.wastage_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Shop owners can access their wastage entries" ON public.wastage_entries;
DROP POLICY IF EXISTS wastage_entries_select ON public.wastage_entries;
DROP POLICY IF EXISTS wastage_entries_insert ON public.wastage_entries;
DROP POLICY IF EXISTS wastage_entries_update ON public.wastage_entries;
DROP POLICY IF EXISTS wastage_entries_delete ON public.wastage_entries;

CREATE POLICY wastage_entries_select ON public.wastage_entries
  FOR SELECT
  TO authenticated
  USING (shop_id = public.get_user_shop_id());

CREATE POLICY wastage_entries_insert ON public.wastage_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY wastage_entries_update ON public.wastage_entries
  FOR UPDATE
  TO authenticated
  USING (shop_id = public.get_user_shop_id())
  WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY wastage_entries_delete ON public.wastage_entries
  FOR DELETE
  TO authenticated
  USING (shop_id = public.get_user_shop_id());

COMMENT ON POLICY wastage_entries_insert ON public.wastage_entries IS
  'Shop members can create wastage entries for their shop (user_profiles.shop_id).';
