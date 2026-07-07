-- Rollback: 20260707110003_infrastructure_triggers

DO $$
DECLARE t TEXT;
  tables TEXT[] := ARRAY[
    'memberships', 'branches', 'warehouses', 'shop_settings',
    'subscriptions', 'invitations', 'user_devices', 'event_outbox',
    'plans', 'platform_settings', 'feature_flags'
  ];
BEGIN
  FOREACH t IN ARRAY tables
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_set_updated_at ON public.%I', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_prevent_hard_delete ON public.%I', t, t);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS private.prevent_hard_delete_if_soft_deleted();
DROP FUNCTION IF EXISTS private.set_updated_at();
