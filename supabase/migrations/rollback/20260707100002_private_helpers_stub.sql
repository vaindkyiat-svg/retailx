-- Rollback: 20260707100002_private_helpers_stub

REVOKE ALL ON FUNCTION private.current_user_id() FROM authenticated;
REVOKE ALL ON FUNCTION private.current_user_id() FROM service_role;
DROP FUNCTION IF EXISTS private.current_user_id();
