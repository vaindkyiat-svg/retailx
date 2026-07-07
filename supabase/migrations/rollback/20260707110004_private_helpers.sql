-- Rollback: 20260707110004_private_helpers

DROP FUNCTION IF EXISTS public.provision_shop_stub(TEXT, TEXT);

DROP FUNCTION IF EXISTS private.is_shop_member(UUID);
DROP FUNCTION IF EXISTS private.is_platform_admin();
DROP FUNCTION IF EXISTS private.current_membership();
DROP FUNCTION IF EXISTS private.current_shop_id();

CREATE OR REPLACE FUNCTION private.current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT NULL::uuid;
$$;

REVOKE ALL ON FUNCTION private.current_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_user_id() TO authenticated, service_role;
