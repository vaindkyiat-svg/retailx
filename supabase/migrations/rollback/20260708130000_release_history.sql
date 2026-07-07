-- Rollback: 20260708130000_release_history

DROP POLICY IF EXISTS release_history_deny_anon ON public.release_history;
DROP POLICY IF EXISTS release_history_deny_authenticated ON public.release_history;

DROP INDEX IF EXISTS idx_release_history_decision;
DROP INDEX IF EXISTS idx_release_history_shop_id;
DROP INDEX IF EXISTS idx_release_history_created_at;

DROP TABLE IF EXISTS public.release_history;
