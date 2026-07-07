-- Rollback: 20260707130000_health_engine

DROP POLICY IF EXISTS health_runs_deny_anon ON public.health_runs;
DROP POLICY IF EXISTS health_runs_deny_authenticated ON public.health_runs;
DROP TABLE IF EXISTS public.health_runs;
