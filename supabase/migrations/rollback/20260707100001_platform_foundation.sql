-- Rollback: 20260707100001_platform_foundation

DROP POLICY IF EXISTS migration_history_deny_all ON public.migration_history;
DROP POLICY IF EXISTS feature_flags_read_authenticated ON public.feature_flags;
DROP POLICY IF EXISTS platform_settings_read_public ON public.platform_settings;
DROP POLICY IF EXISTS role_permissions_read_authenticated ON public.role_permissions;
DROP POLICY IF EXISTS permissions_read_authenticated ON public.permissions;
DROP POLICY IF EXISTS system_roles_read_authenticated ON public.system_roles;
DROP POLICY IF EXISTS plans_read_authenticated ON public.plans;

DROP TABLE IF EXISTS public.feature_flags;
DROP TABLE IF EXISTS public.platform_settings;
DROP TABLE IF EXISTS public.role_permissions;
DROP TABLE IF EXISTS public.permissions;
DROP TABLE IF EXISTS public.system_roles;
DROP TABLE IF EXISTS public.plans;

DROP INDEX IF EXISTS uq_migration_history_version_env_status;
DROP INDEX IF EXISTS idx_migration_history_version;
DROP INDEX IF EXISTS idx_migration_history_applied_at;

DROP SCHEMA IF EXISTS private CASCADE;
