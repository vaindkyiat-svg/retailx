-- Migration: 20260707110007_rls_skeleton
-- RetailX V2 Milestone B — RLS skeleton on new V2 tables only
-- Does NOT modify existing V1 table policies

ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing V2 policies for idempotency
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname LIKE 'v2_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ─── Memberships ───
CREATE POLICY v2_memberships_platform_admin_select ON public.memberships
  FOR SELECT TO authenticated USING (private.is_platform_admin());

CREATE POLICY v2_memberships_shop_member_select ON public.memberships
  FOR SELECT TO authenticated USING (private.is_shop_member(shop_id));

CREATE POLICY v2_memberships_deny_insert ON public.memberships
  FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY v2_memberships_deny_update ON public.memberships
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY v2_memberships_deny_delete ON public.memberships
  FOR DELETE TO authenticated USING (false);

CREATE POLICY v2_memberships_anon_deny ON public.memberships
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- ─── Branches ───
CREATE POLICY v2_branches_platform_admin_select ON public.branches
  FOR SELECT TO authenticated USING (private.is_platform_admin());

CREATE POLICY v2_branches_shop_member_select ON public.branches
  FOR SELECT TO authenticated USING (private.is_shop_member(shop_id));

CREATE POLICY v2_branches_deny_insert ON public.branches
  FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY v2_branches_deny_update ON public.branches
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY v2_branches_deny_delete ON public.branches
  FOR DELETE TO authenticated USING (false);

CREATE POLICY v2_branches_anon_deny ON public.branches
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- ─── Warehouses ───
CREATE POLICY v2_warehouses_platform_admin_select ON public.warehouses
  FOR SELECT TO authenticated USING (private.is_platform_admin());

CREATE POLICY v2_warehouses_shop_member_select ON public.warehouses
  FOR SELECT TO authenticated USING (private.is_shop_member(shop_id));

CREATE POLICY v2_warehouses_deny_insert ON public.warehouses
  FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY v2_warehouses_deny_update ON public.warehouses
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY v2_warehouses_deny_delete ON public.warehouses
  FOR DELETE TO authenticated USING (false);

CREATE POLICY v2_warehouses_anon_deny ON public.warehouses
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- ─── Shop settings ───
CREATE POLICY v2_shop_settings_platform_admin_select ON public.shop_settings
  FOR SELECT TO authenticated USING (private.is_platform_admin());

CREATE POLICY v2_shop_settings_shop_member_select ON public.shop_settings
  FOR SELECT TO authenticated USING (private.is_shop_member(shop_id));

CREATE POLICY v2_shop_settings_deny_insert ON public.shop_settings
  FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY v2_shop_settings_deny_update ON public.shop_settings
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY v2_shop_settings_deny_delete ON public.shop_settings
  FOR DELETE TO authenticated USING (false);

CREATE POLICY v2_shop_settings_anon_deny ON public.shop_settings
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- ─── Subscriptions ───
CREATE POLICY v2_subscriptions_platform_admin_select ON public.subscriptions
  FOR SELECT TO authenticated USING (private.is_platform_admin());

CREATE POLICY v2_subscriptions_shop_member_select ON public.subscriptions
  FOR SELECT TO authenticated USING (private.is_shop_member(shop_id));

CREATE POLICY v2_subscriptions_deny_insert ON public.subscriptions
  FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY v2_subscriptions_deny_update ON public.subscriptions
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY v2_subscriptions_deny_delete ON public.subscriptions
  FOR DELETE TO authenticated USING (false);

CREATE POLICY v2_subscriptions_anon_deny ON public.subscriptions
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- ─── Invitations ───
CREATE POLICY v2_invitations_platform_admin_select ON public.invitations
  FOR SELECT TO authenticated USING (private.is_platform_admin());

CREATE POLICY v2_invitations_shop_member_select ON public.invitations
  FOR SELECT TO authenticated USING (private.is_shop_member(shop_id));

CREATE POLICY v2_invitations_deny_insert ON public.invitations
  FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY v2_invitations_deny_update ON public.invitations
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY v2_invitations_deny_delete ON public.invitations
  FOR DELETE TO authenticated USING (false);

CREATE POLICY v2_invitations_anon_deny ON public.invitations
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- ─── User devices ───
CREATE POLICY v2_user_devices_own_select ON public.user_devices
  FOR SELECT TO authenticated USING (user_id = private.current_user_id());

CREATE POLICY v2_user_devices_platform_admin_select ON public.user_devices
  FOR SELECT TO authenticated USING (private.is_platform_admin());

CREATE POLICY v2_user_devices_deny_insert ON public.user_devices
  FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY v2_user_devices_deny_update ON public.user_devices
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY v2_user_devices_deny_delete ON public.user_devices
  FOR DELETE TO authenticated USING (false);

CREATE POLICY v2_user_devices_anon_deny ON public.user_devices
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- ─── Event outbox (internal only) ───
CREATE POLICY v2_event_outbox_deny_authenticated ON public.event_outbox
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

CREATE POLICY v2_event_outbox_anon_deny ON public.event_outbox
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- ─── Audit logs ───
CREATE POLICY v2_audit_logs_platform_admin_select ON public.audit_logs
  FOR SELECT TO authenticated USING (private.is_platform_admin());

CREATE POLICY v2_audit_logs_shop_member_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (shop_id IS NOT NULL AND private.is_shop_member(shop_id));

CREATE POLICY v2_audit_logs_deny_insert ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (false);

CREATE POLICY v2_audit_logs_deny_update ON public.audit_logs
  FOR UPDATE TO authenticated USING (false);

CREATE POLICY v2_audit_logs_deny_delete ON public.audit_logs
  FOR DELETE TO authenticated USING (false);

CREATE POLICY v2_audit_logs_anon_deny ON public.audit_logs
  FOR ALL TO anon USING (false) WITH CHECK (false);
