-- Migration: 20260708130000_release_history
-- RetailX V2 Milestone D1.4A — Release history archive

CREATE TABLE IF NOT EXISTS public.release_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  shop_id UUID,
  decision TEXT NOT NULL CHECK (decision IN ('GO', 'HOLD', 'ROLLBACK', 'BLOCK')),
  metrics_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  approved_by TEXT,
  rollback BOOLEAN NOT NULL DEFAULT false,
  duration_ms INTEGER,
  reasons TEXT[] NOT NULL DEFAULT '{}',
  correlation_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_release_history_created_at
  ON public.release_history (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_release_history_shop_id
  ON public.release_history (shop_id);

CREATE INDEX IF NOT EXISTS idx_release_history_decision
  ON public.release_history (decision);

COMMENT ON TABLE public.release_history IS
  'Milestone D1.4A release engineering decision archive. Browser uses in-memory store in D1.4A.';

ALTER TABLE public.release_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY release_history_deny_authenticated ON public.release_history
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY release_history_deny_anon ON public.release_history
  FOR ALL TO anon USING (false) WITH CHECK (false);
