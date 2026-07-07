-- Migration: 20260707150000_identity_validation
-- RetailX V2 Milestone D1.3 — Shadow identity validation log (server-side archive)

CREATE TABLE IF NOT EXISTS public.identity_validation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  shop_id UUID,
  email TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN ('MATCH', 'MISMATCH')),
  duration_ms INTEGER NOT NULL DEFAULT 0,
  mismatch_categories TEXT[] NOT NULL DEFAULT '{}',
  mismatch_count INTEGER NOT NULL DEFAULT 0,
  trigger_source TEXT NOT NULL DEFAULT 'sign_in'
    CHECK (trigger_source IN ('sign_in', 'session_restore')),
  comparison_report JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_identity_validation_log_created_at
  ON public.identity_validation_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_identity_validation_log_user_id
  ON public.identity_validation_log (user_id);

CREATE INDEX IF NOT EXISTS idx_identity_validation_log_outcome
  ON public.identity_validation_log (outcome);

COMMENT ON TABLE public.identity_validation_log IS
  'Milestone D1.3 shadow identity validation archive. Browser shadow mode uses in-memory log; this table is for server-side persistence.';

ALTER TABLE public.identity_validation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY identity_validation_log_deny_authenticated ON public.identity_validation_log
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY identity_validation_log_deny_anon ON public.identity_validation_log
  FOR ALL TO anon USING (false) WITH CHECK (false);
