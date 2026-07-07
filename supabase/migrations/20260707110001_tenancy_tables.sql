-- Migration: 20260707110001_tenancy_tables
-- RetailX V2 Milestone B — Core tenancy tables (additive; V1 shops unchanged)

-- ─── Memberships: user ↔ shop ↔ role (V2 auth model) ───
CREATE TABLE IF NOT EXISTS public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  shop_id UUID NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE ON UPDATE CASCADE,
  role_id UUID NOT NULL REFERENCES public.system_roles (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  status public.membership_status NOT NULL DEFAULT 'active',
  is_primary BOOLEAN NOT NULL DEFAULT false,
  invited_by UUID,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT memberships_status_check CHECK (status IN ('active', 'suspended', 'removed')),
  CONSTRAINT memberships_user_shop_unique UNIQUE (user_id, shop_id)
);

COMMENT ON TABLE public.memberships IS
  'V2 user-shop-role assignments. Coexists with V1 user_profiles; not used by V1 app yet.';

-- FK to auth.users when Supabase auth schema is present
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'auth' AND table_name = 'users'
  ) THEN
    ALTER TABLE public.memberships
      ADD CONSTRAINT memberships_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users (id)
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ─── Branches ───
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE ON UPDATE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  status public.branch_status NOT NULL DEFAULT 'active',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT branches_name_not_empty CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE public.branches IS
  'Physical/logical shop locations. Default branch auto-created during provisioning (future milestone).';

CREATE UNIQUE INDEX IF NOT EXISTS uq_branches_shop_code
  ON public.branches (shop_id, code)
  WHERE code IS NOT NULL AND deleted_at IS NULL;

-- ─── Warehouses ───
CREATE TABLE IF NOT EXISTS public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE ON UPDATE CASCADE,
  branch_id UUID REFERENCES public.branches (id) ON DELETE SET NULL ON UPDATE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  status public.warehouse_status NOT NULL DEFAULT 'active',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT warehouses_name_not_empty CHECK (length(trim(name)) > 0)
);

COMMENT ON TABLE public.warehouses IS
  'Inventory storage locations. Optional branch association.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_warehouses_shop_code
  ON public.warehouses (shop_id, code)
  WHERE code IS NOT NULL AND deleted_at IS NULL;

-- ─── Shop settings (per-tenant key-value) ───
CREATE TABLE IF NOT EXISTS public.shop_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE ON UPDATE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT shop_settings_key_not_empty CHECK (length(trim(key)) > 0),
  CONSTRAINT shop_settings_shop_key_unique UNIQUE (shop_id, key)
);

COMMENT ON TABLE public.shop_settings IS
  'Per-shop configuration. Distinct from platform_settings (global).';

-- ─── Subscriptions: shop ↔ plan ───
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE ON UPDATE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans (id) ON DELETE RESTRICT ON UPDATE CASCADE,
  status public.subscription_status NOT NULL DEFAULT 'active',
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_status_check CHECK (
    status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired')
  ),
  CONSTRAINT subscriptions_shop_unique UNIQUE (shop_id)
);

COMMENT ON TABLE public.subscriptions IS
  'Shop billing subscription. One row per shop. V1 shops.plan TEXT remains authoritative for V1 app.';
