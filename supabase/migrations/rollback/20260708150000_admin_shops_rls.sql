-- Rollback: 20260708150000_admin_shops_rls

DROP POLICY IF EXISTS admins_manage_all_shops ON public.shops;
