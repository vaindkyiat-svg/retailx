-- Migration: 20260707110002_operational_tables
-- RetailX V2 Milestone B — Invitations, devices, outbox, audit

-- ─── Invitations ───
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE ON UPDATE CASCADE,
  email TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES public.system_roles (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  invited_by UUID,
  token_hash TEXT NOT NULL,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invitations_email_not_empty CHECK (length(trim(email)) > 0),
  CONSTRAINT invitations_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT invitations_token_hash_not_empty CHECK (length(trim(token_hash)) > 0),
  CONSTRAINT invitations_status_check CHECK (
    status IN ('pending', 'accepted', 'expired', 'revoked')
  )
);

COMMENT ON TABLE public.invitations IS
  'Pending shop user invitations. Processed by provisioning milestone (not yet active).';

CREATE UNIQUE INDEX IF NOT EXISTS uq_invitations_pending_email_shop
  ON public.invitations (shop_id, lower(email))
  WHERE status = 'pending';

-- ─── User devices ───
CREATE TABLE IF NOT EXISTS public.user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  shop_id UUID REFERENCES public.shops (id) ON DELETE CASCADE ON UPDATE CASCADE,
  device_fingerprint TEXT NOT NULL,
  platform public.device_platform NOT NULL DEFAULT 'unknown',
  device_name TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_trusted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_devices_fingerprint_not_empty CHECK (length(trim(device_fingerprint)) > 0),
  CONSTRAINT user_devices_user_fingerprint_unique UNIQUE (user_id, device_fingerprint)
);

COMMENT ON TABLE public.user_devices IS
  'Registered client devices per user for session management (future milestone).';

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    ALTER TABLE public.user_devices
      ADD CONSTRAINT user_devices_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users (id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── Event outbox (async domain events) ───
CREATE TABLE IF NOT EXISTS public.event_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops (id) ON DELETE CASCADE ON UPDATE CASCADE,
  event_type TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.outbox_status NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT event_outbox_attempts_non_negative CHECK (attempts >= 0),
  CONSTRAINT event_outbox_event_type_not_empty CHECK (length(trim(event_type)) > 0)
);

COMMENT ON TABLE public.event_outbox IS
  'Transactional outbox for async event publishing. Infrastructure only; no publishers yet.';

-- ─── Audit logs (append-only) ───
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES public.shops (id) ON DELETE SET NULL ON UPDATE CASCADE,
  user_id UUID,
  action public.audit_action NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_entity_type_not_empty CHECK (length(trim(entity_type)) > 0),
  CONSTRAINT audit_logs_entity_id_not_empty CHECK (length(trim(entity_id)) > 0)
);

COMMENT ON TABLE public.audit_logs IS
  'Immutable audit trail. Append-only; no updated_at by design.';
