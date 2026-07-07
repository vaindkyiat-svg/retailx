-- Migration: 20260707110003_infrastructure_triggers
-- RetailX V2 Milestone B — updated_at triggers and soft-delete support

-- Generic updated_at trigger function
CREATE OR REPLACE FUNCTION private.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION private.set_updated_at IS
  'Infrastructure trigger: sets updated_at to now() on row update.';

-- Apply updated_at triggers to V2 tables (idempotent via DROP IF EXISTS)
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'memberships', 'branches', 'warehouses', 'shop_settings',
    'subscriptions', 'invitations', 'user_devices', 'event_outbox'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_set_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_set_updated_at
       BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION private.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- Also apply to Milestone A tables that have updated_at
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['plans', 'platform_settings', 'feature_flags'];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_set_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_set_updated_at
       BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION private.set_updated_at()',
      t, t
    );
  END LOOP;
END $$;

-- Prevent hard-delete on soft-delete tables (infrastructure guard)
CREATE OR REPLACE FUNCTION private.prevent_hard_delete_if_soft_deleted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL THEN
    RETURN NULL;
  END IF;
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION private.prevent_hard_delete_if_soft_deleted IS
  'Infrastructure stub: blocks DELETE on already soft-deleted rows. Full soft-delete in later milestone.';

DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY['memberships', 'branches', 'warehouses'];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_prevent_hard_delete ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_prevent_hard_delete
       BEFORE DELETE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION private.prevent_hard_delete_if_soft_deleted()',
      t, t
    );
  END LOOP;
END $$;

REVOKE ALL ON FUNCTION private.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.prevent_hard_delete_if_soft_deleted() FROM PUBLIC;
