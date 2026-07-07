-- Rollback: 20260707120000_backfill_audit

DROP POLICY IF EXISTS backfill_runs_deny_anon ON public.backfill_runs;
DROP POLICY IF EXISTS backfill_runs_deny_authenticated ON public.backfill_runs;
DROP TABLE IF EXISTS public.backfill_runs;
