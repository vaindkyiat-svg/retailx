-- Rollback: 20260707140000_cutover_simulation

DROP POLICY IF EXISTS cutover_runs_deny_anon ON public.cutover_runs;
DROP POLICY IF EXISTS cutover_runs_deny_authenticated ON public.cutover_runs;
DROP TABLE IF EXISTS public.cutover_runs;
