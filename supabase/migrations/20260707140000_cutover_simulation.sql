-- Migration: 20260707140000_cutover_simulation
-- RetailX V2 Milestone C3 — Cutover simulation run tracking

CREATE TABLE IF NOT EXISTS public.cutover_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT NOT NULL,
  milestone TEXT NOT NULL DEFAULT 'C3',
  environment TEXT NOT NULL DEFAULT 'staging',
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'passed', 'failed', 'aborted')),
  health_score NUMERIC(6, 3),
  total_duration_ms INTEGER,
  cutover_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  performance_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cutover_runs_run_id
  ON public.cutover_runs (run_id);

CREATE INDEX IF NOT EXISTS idx_cutover_runs_started_at
  ON public.cutover_runs (started_at DESC);

COMMENT ON TABLE public.cutover_runs IS
  'Milestone C3 staging cutover simulation history. Simulation only — no production changes.';

ALTER TABLE public.cutover_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY cutover_runs_deny_authenticated ON public.cutover_runs
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY cutover_runs_deny_anon ON public.cutover_runs
  FOR ALL TO anon USING (false) WITH CHECK (false);
