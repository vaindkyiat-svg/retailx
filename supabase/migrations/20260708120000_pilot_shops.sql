-- Migration: 20260708120000_pilot_shops
-- RetailX V2 Milestone D1.4 — Internal shop auth pilot configuration

CREATE TABLE IF NOT EXISTS public.pilot_shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  enabled_by TEXT,
  enabled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pilot_shops_shop_id_unique UNIQUE (shop_id)
);

-- Only one shop may be pilot-enabled at a time (controlled rollout)
CREATE UNIQUE INDEX IF NOT EXISTS idx_pilot_shops_single_active
  ON public.pilot_shops ((1))
  WHERE enabled = true;

CREATE INDEX IF NOT EXISTS idx_pilot_shops_shop_id
  ON public.pilot_shops (shop_id);

CREATE INDEX IF NOT EXISTS idx_pilot_shops_enabled
  ON public.pilot_shops (enabled)
  WHERE enabled = true;

COMMENT ON TABLE public.pilot_shops IS
  'Milestone D1.4 internal shop auth pilot. At most one shop may have enabled=true.';

ALTER TABLE public.pilot_shops ENABLE ROW LEVEL SECURITY;

-- Read-only for authenticated clients (shop_id + enabled only — no secrets)
CREATE POLICY pilot_shops_select_authenticated ON public.pilot_shops
  FOR SELECT TO authenticated USING (true);

CREATE POLICY pilot_shops_deny_write_authenticated ON public.pilot_shops
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY pilot_shops_deny_anon ON public.pilot_shops
  FOR ALL TO anon USING (false) WITH CHECK (false);
