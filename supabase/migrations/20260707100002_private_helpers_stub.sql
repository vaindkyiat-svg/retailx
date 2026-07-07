-- Migration: 20260707100002_private_helpers_stub
-- RetailX V2 Milestone A — Stub private helpers (full implementation in later milestones)

CREATE OR REPLACE FUNCTION private.current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT NULL::uuid;
$$;

COMMENT ON FUNCTION private.current_user_id IS
  'Returns the authenticated user id. Stub for Milestone A.';

REVOKE ALL ON FUNCTION private.current_user_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.current_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION private.current_user_id() TO service_role;
