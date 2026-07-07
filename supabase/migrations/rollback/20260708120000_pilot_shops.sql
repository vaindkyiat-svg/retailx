-- Rollback: 20260708120000_pilot_shops

DROP POLICY IF EXISTS pilot_shops_deny_anon ON public.pilot_shops;
DROP POLICY IF EXISTS pilot_shops_deny_write_authenticated ON public.pilot_shops;
DROP POLICY IF EXISTS pilot_shops_select_authenticated ON public.pilot_shops;

DROP INDEX IF EXISTS idx_pilot_shops_enabled;
DROP INDEX IF EXISTS idx_pilot_shops_shop_id;
DROP INDEX IF EXISTS idx_pilot_shops_single_active;

DROP TABLE IF EXISTS public.pilot_shops;
