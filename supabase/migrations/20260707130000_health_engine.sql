-- Migration: 20260707130000_health_engine
-- RetailX V2 Milestone C2 — Health run history for validation engine

CREATE TABLE IF NOT EXISTS public.health_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT NOT NULL,
  milestone TEXT NOT NULL DEFAULT 'C2',
  environment TEXT NOT NULL DEFAULT 'development',
  trigger TEXT NOT NULL DEFAULT 'manual'
    CHECK (trigger IN ('manual', 'daily', 'weekly', 'ci', 'repair')),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'healthy', 'degraded', 'unhealthy', 'failed')),
  health_score NUMERIC(6, 3),
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_health_runs_run_id
  ON public.health_runs (run_id);

CREATE INDEX IF NOT EXISTS idx_health_runs_started_at
  ON public.health_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_runs_environment
  ON public.health_runs (environment, started_at DESC);

COMMENT ON TABLE public.health_runs IS
  'Milestone C2 validation & health engine run history.';

ALTER TABLE public.health_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY health_runs_deny_authenticated ON public.health_runs
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY health_runs_deny_anon ON public.health_runs
  FOR ALL TO anon USING (false) WITH CHECK (false);
