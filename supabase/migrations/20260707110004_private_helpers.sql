-- Migration: 20260707110004_private_helpers
-- RetailX V2 Milestone B — Security definer helpers with V1 fallback

-- Ensure auth.uid() stub exists for non-Supabase environments (CI)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'auth' AND p.proname = 'uid'
  ) THEN
    CREATE SCHEMA IF NOT EXISTS auth;
    EXECUTE $sql$
      CREATE OR REPLACE FUNCTION auth.uid()
      RETURNS UUID
      LANGUAGE sql
      STABLE
      AS $fn$ SELECT NULL::uuid $fn$
    $sql$;
  END IF;
END $$;

-- ─── current_user_id ───
CREATE OR REPLACE FUNCTION private.current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public, auth
AS $$
  SELECT auth.uid();
$$;

-- ─── current_shop_id (V1 user_profiles fallback) ───
CREATE OR REPLACE FUNCTION private.current_shop_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  v_shop_id UUID;
  v_user_id UUID;
BEGIN
  v_user_id := private.current_user_id();
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- V2 path: active primary membership
  SELECT m.shop_id INTO v_shop_id
  FROM public.memberships m
  WHERE m.user_id = v_user_id
    AND m.status = 'active'
    AND m.deleted_at IS NULL
    AND m.is_primary = true
  LIMIT 1;

  IF v_shop_id IS NOT NULL THEN
    RETURN v_shop_id;
  END IF;

  -- V2 path: any active membership
  SELECT m.shop_id INTO v_shop_id
  FROM public.memberships m
  WHERE m.user_id = v_user_id
    AND m.status = 'active'
    AND m.deleted_at IS NULL
  ORDER BY m.joined_at ASC
  LIMIT 1;

  IF v_shop_id IS NOT NULL THEN
    RETURN v_shop_id;
  END IF;

  -- V1 fallback: user_profiles (keeps existing app working)
  SELECT up.shop_id INTO v_shop_id
  FROM public.user_profiles up
  WHERE up.id = v_user_id
  LIMIT 1;

  RETURN v_shop_id;
END;
$$;

-- ─── current_membership ───
CREATE OR REPLACE FUNCTION private.current_membership()
RETURNS public.memberships
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
  v_user_id UUID;
  v_membership public.memberships;
BEGIN
  v_user_id := private.current_user_id();
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT m.* INTO v_membership
  FROM public.memberships m
  WHERE m.user_id = v_user_id
    AND m.status = 'active'
    AND m.deleted_at IS NULL
  ORDER BY m.is_primary DESC, m.joined_at ASC
  LIMIT 1;

  RETURN v_membership;
END;
$$;

-- ─── is_platform_admin ───
CREATE OR REPLACE FUNCTION private.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships m
    JOIN public.system_roles r ON r.id = m.role_id
    WHERE m.user_id = private.current_user_id()
      AND m.status = 'active'
      AND m.deleted_at IS NULL
      AND r.slug IN ('platform_admin', 'platform_support')
      AND r.scope = 'platform'
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = private.current_user_id()
      AND up.role = 'admin'
  );
$$;

-- ─── is_shop_member ───
CREATE OR REPLACE FUNCTION private.is_shop_member(p_shop_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT
    CASE
      WHEN p_shop_id IS NULL THEN false
      ELSE (
        EXISTS (
          SELECT 1
          FROM public.memberships m
          WHERE m.user_id = private.current_user_id()
            AND m.shop_id = p_shop_id
            AND m.status = 'active'
            AND m.deleted_at IS NULL
        )
        OR EXISTS (
          SELECT 1
          FROM public.user_profiles up
          WHERE up.id = private.current_user_id()
            AND up.shop_id = p_shop_id
        )
        OR private.is_platform_admin()
      )
    END;
$$;

-- ─── Stub: provision_shop (signature only, no business logic) ───
CREATE OR REPLACE FUNCTION public.provision_shop_stub(
  p_shop_name TEXT,
  p_owner_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'provision_shop not implemented — Milestone B database foundation only'
    USING ERRCODE = 'feature_not_supported';
END;
$$;

COMMENT ON FUNCTION public.provision_shop_stub IS
  'Placeholder signature for future provisioning RPC. Not callable in production.';

-- Grants
REVOKE ALL ON FUNCTION private.current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_shop_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.current_membership() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_shop_member(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.current_user_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_shop_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.current_membership() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_platform_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_shop_member(UUID) TO authenticated, service_role;
