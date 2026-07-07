-- Migration: 20260707120000_backfill_audit
-- RetailX V2 Milestone C1 — Backfill run tracking (infrastructure only)

CREATE TABLE IF NOT EXISTS public.backfill_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id TEXT NOT NULL,
  milestone TEXT NOT NULL DEFAULT 'C1',
  environment TEXT NOT NULL DEFAULT 'development',
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'completed', 'failed', 'rolled_back')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  report JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_backfill_runs_run_id
  ON public.backfill_runs (run_id);

CREATE INDEX IF NOT EXISTS idx_backfill_runs_milestone
  ON public.backfill_runs (milestone, started_at DESC);

COMMENT ON TABLE public.backfill_runs IS
  'Tracks V1→V2 data backfill executions. Milestone C1 infrastructure.';

ALTER TABLE public.backfill_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY backfill_runs_deny_authenticated ON public.backfill_runs
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY backfill_runs_deny_anon ON public.backfill_runs
  FOR ALL TO anon USING (false) WITH CHECK (false);
