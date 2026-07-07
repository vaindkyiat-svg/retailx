-- Migration: 20260707100001_platform_foundation
-- RetailX V2 Milestone A — Foundation tables for seeds, flags, migration tracking

-- ─── Migration history (custom pipeline; complements supabase_migrations) ───
-- Bootstrap table created in 20260707100000; alter to use enum when available
DO $$ BEGIN
  ALTER TABLE public.migration_history
    ALTER COLUMN status TYPE public.migration_status
    USING status::public.migration_status;
EXCEPTION
  WHEN undefined_object THEN NULL;
  WHEN others THEN NULL;
END $$;

ALTER TABLE public.migration_history
  ADD COLUMN IF NOT EXISTS rolled_back_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_migration_history_version_env_status
  ON public.migration_history (version, environment, status);

CREATE INDEX IF NOT EXISTS idx_migration_history_version
  ON public.migration_history (version);

CREATE INDEX IF NOT EXISTS idx_migration_history_applied_at
  ON public.migration_history (applied_at DESC);

-- ─── Plans ───
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  max_users INTEGER NOT NULL DEFAULT 5,
  max_branches INTEGER NOT NULL DEFAULT 1,
  max_products INTEGER,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  price_monthly_paise BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_plans_code ON public.plans (code);

-- ─── System roles ───
CREATE TABLE IF NOT EXISTS public.system_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  scope public.role_scope NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_system_roles_slug ON public.system_roles (slug);

-- ─── Permissions ───
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  description TEXT,
  context TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_permissions_code ON public.permissions (code);

-- ─── Role permissions ───
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.system_roles (id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

-- ─── Platform settings (includes feature flags) ───
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_settings_category
  ON public.platform_settings (category);

-- ─── Dedicated feature flags view table (denormalized for fast reads) ───
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  environments JSONB NOT NULL DEFAULT '{"development": false, "staging": false, "production": false}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Private schema for future RLS helpers ───
CREATE SCHEMA IF NOT EXISTS private;

COMMENT ON SCHEMA private IS 'Security definer functions — not exposed via PostgREST';

-- ─── RLS: infrastructure tables are read-only for authenticated; writes via service role ───
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_history ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read public platform data
CREATE POLICY plans_read_authenticated ON public.plans
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY system_roles_read_authenticated ON public.system_roles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY permissions_read_authenticated ON public.permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY role_permissions_read_authenticated ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY platform_settings_read_public ON public.platform_settings
  FOR SELECT TO authenticated USING (is_public = true);

CREATE POLICY feature_flags_read_authenticated ON public.feature_flags
  FOR SELECT TO authenticated USING (true);

-- Migration history: no client access
CREATE POLICY migration_history_deny_all ON public.migration_history
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
