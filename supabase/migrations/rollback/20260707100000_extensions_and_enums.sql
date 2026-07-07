-- Rollback: 20260707100000_extensions_and_enums

DROP TYPE IF EXISTS public.migration_status;
DROP TYPE IF EXISTS public.role_scope;
DROP TYPE IF EXISTS public.invitation_status;
DROP TYPE IF EXISTS public.membership_status;
DROP TYPE IF EXISTS public.subscription_status;
DROP TYPE IF EXISTS public.shop_status;
DROP TYPE IF EXISTS public.organization_status;

DROP TABLE IF EXISTS public.migration_history;

-- Extensions are left in place (shared infrastructure)
