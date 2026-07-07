-- Migration: 20260707110005_milestone_b_indexes
-- RetailX V2 Milestone B — Performance indexes with documented purpose

-- ─── memberships ───
CREATE INDEX IF NOT EXISTS idx_memberships_shop_id
  ON public.memberships (shop_id);
COMMENT ON INDEX idx_memberships_shop_id IS
  'List all members of a shop — admin user management, RLS membership checks.';

CREATE INDEX IF NOT EXISTS idx_memberships_user_id
  ON public.memberships (user_id);
COMMENT ON INDEX idx_memberships_user_id IS
  'Resolve all shops a user belongs to — login context, shop switcher.';

CREATE INDEX IF NOT EXISTS idx_memberships_role_id
  ON public.memberships (role_id);
COMMENT ON INDEX idx_memberships_role_id IS
  'Filter members by role — permission audits, bulk role queries.';

CREATE INDEX IF NOT EXISTS idx_memberships_status
  ON public.memberships (status);
COMMENT ON INDEX idx_memberships_status IS
  'Filter active/suspended/removed members — access control queries.';

CREATE INDEX IF NOT EXISTS idx_memberships_created_at
  ON public.memberships (created_at DESC);
COMMENT ON INDEX idx_memberships_created_at IS
  'Chronological member listing — onboarding reports.';

CREATE INDEX IF NOT EXISTS idx_memberships_active_shop
  ON public.memberships (shop_id, user_id)
  WHERE status = 'active' AND deleted_at IS NULL;
COMMENT ON INDEX idx_memberships_active_shop IS
  'Partial index for active membership lookups — hot path for RLS helpers.';

-- ─── branches ───
CREATE INDEX IF NOT EXISTS idx_branches_shop_id
  ON public.branches (shop_id);
COMMENT ON INDEX idx_branches_shop_id IS
  'List branches per shop — branch selector, multi-location ops.';

CREATE INDEX IF NOT EXISTS idx_branches_status
  ON public.branches (status);
COMMENT ON INDEX idx_branches_status IS
  'Filter active/inactive branches — UI branch lists.';

CREATE INDEX IF NOT EXISTS idx_branches_created_at
  ON public.branches (created_at DESC);
COMMENT ON INDEX idx_branches_created_at IS
  'Recent branch creation audit — provisioning reports.';

CREATE INDEX IF NOT EXISTS idx_branches_default
  ON public.branches (shop_id)
  WHERE is_default = true AND deleted_at IS NULL;
COMMENT ON INDEX idx_branches_default IS
  'Fast lookup of default branch per shop — checkout/inventory defaults.';

-- ─── warehouses ───
CREATE INDEX IF NOT EXISTS idx_warehouses_shop_id
  ON public.warehouses (shop_id);
COMMENT ON INDEX idx_warehouses_shop_id IS
  'List warehouses per shop — inventory location queries.';

CREATE INDEX IF NOT EXISTS idx_warehouses_branch_id
  ON public.warehouses (branch_id);
COMMENT ON INDEX idx_warehouses_branch_id IS
  'Warehouses by branch — branch-scoped stock views.';

CREATE INDEX IF NOT EXISTS idx_warehouses_status
  ON public.warehouses (status);
COMMENT ON INDEX idx_warehouses_status IS
  'Filter active warehouses — stock allocation.';

CREATE INDEX IF NOT EXISTS idx_warehouses_created_at
  ON public.warehouses (created_at DESC);
COMMENT ON INDEX idx_warehouses_created_at IS
  'Chronological warehouse listing — setup audit.';

-- ─── shop_settings ───
CREATE INDEX IF NOT EXISTS idx_shop_settings_shop_id
  ON public.shop_settings (shop_id);
COMMENT ON INDEX idx_shop_settings_shop_id IS
  'Load all settings for a shop — settings page, config resolution.';

CREATE INDEX IF NOT EXISTS idx_shop_settings_created_at
  ON public.shop_settings (created_at DESC);
COMMENT ON INDEX idx_shop_settings_created_at IS
  'Recent settings changes — audit trail support.';

-- ─── subscriptions ───
CREATE INDEX IF NOT EXISTS idx_subscriptions_shop_id
  ON public.subscriptions (shop_id);
COMMENT ON INDEX idx_subscriptions_shop_id IS
  'Lookup subscription by shop — billing dashboard (unique constraint also covers this).';

CREATE INDEX IF NOT EXISTS idx_subscriptions_status
  ON public.subscriptions (status);
COMMENT ON INDEX idx_subscriptions_status IS
  'Filter by subscription state — billing cron, dunning.';

CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_id
  ON public.subscriptions (plan_id);
COMMENT ON INDEX idx_subscriptions_plan_id IS
  'Aggregate shops per plan — revenue analytics.';

CREATE INDEX IF NOT EXISTS idx_subscriptions_created_at
  ON public.subscriptions (created_at DESC);
COMMENT ON INDEX idx_subscriptions_created_at IS
  'Recent subscription events — onboarding funnel.';

-- ─── invitations ───
CREATE INDEX IF NOT EXISTS idx_invitations_shop_id
  ON public.invitations (shop_id);
COMMENT ON INDEX idx_invitations_shop_id IS
  'Pending invites per shop — team management UI.';

CREATE INDEX IF NOT EXISTS idx_invitations_email
  ON public.invitations (lower(email));
COMMENT ON INDEX idx_invitations_email IS
  'Lookup invite by email — accept-invite flow.';

CREATE INDEX IF NOT EXISTS idx_invitations_status
  ON public.invitations (status);
COMMENT ON INDEX idx_invitations_status IS
  'Filter pending/expired invites — cleanup jobs.';

CREATE INDEX IF NOT EXISTS idx_invitations_created_at
  ON public.invitations (created_at DESC);
COMMENT ON INDEX idx_invitations_created_at IS
  'Recent invitations — activity feed.';

-- ─── user_devices ───
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id
  ON public.user_devices (user_id);
COMMENT ON INDEX idx_user_devices_user_id IS
  'List devices per user — session management.';

CREATE INDEX IF NOT EXISTS idx_user_devices_shop_id
  ON public.user_devices (shop_id);
COMMENT ON INDEX idx_user_devices_shop_id IS
  'Devices registered to a shop — device policy enforcement.';

CREATE INDEX IF NOT EXISTS idx_user_devices_created_at
  ON public.user_devices (created_at DESC);
COMMENT ON INDEX idx_user_devices_created_at IS
  'Recent device registrations — security audit.';

-- ─── event_outbox ───
CREATE INDEX IF NOT EXISTS idx_event_outbox_shop_id
  ON public.event_outbox (shop_id);
COMMENT ON INDEX idx_event_outbox_shop_id IS
  'Shop-scoped event replay — tenant event streams.';

CREATE INDEX IF NOT EXISTS idx_event_outbox_status
  ON public.event_outbox (status);
COMMENT ON INDEX idx_event_outbox_status IS
  'Poller fetches pending events — outbox processor hot path.';

CREATE INDEX IF NOT EXISTS idx_event_outbox_created_at
  ON public.event_outbox (created_at DESC);
COMMENT ON INDEX idx_event_outbox_created_at IS
  'Event chronology — debugging and replay ordering.';

CREATE INDEX IF NOT EXISTS idx_event_outbox_pending_poll
  ON public.event_outbox (available_at ASC)
  WHERE status = 'pending';
COMMENT ON INDEX idx_event_outbox_pending_poll IS
  'Partial index for outbox poller — pending events ready for dispatch.';

-- ─── audit_logs ───
CREATE INDEX IF NOT EXISTS idx_audit_logs_shop_id
  ON public.audit_logs (shop_id);
COMMENT ON INDEX idx_audit_logs_shop_id IS
  'Shop audit history — compliance reports.';

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
  ON public.audit_logs (user_id);
COMMENT ON INDEX idx_audit_logs_user_id IS
  'User activity trail — security investigations.';

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON public.audit_logs (created_at DESC);
COMMENT ON INDEX idx_audit_logs_created_at IS
  'Time-ordered audit log — paginated audit UI.';

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON public.audit_logs (entity_type, entity_id);
COMMENT ON INDEX idx_audit_logs_entity IS
  'Entity change history — per-record audit trail.';

-- ─── role_permissions (Milestone B addition) ───
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id
  ON public.role_permissions (role_id);
COMMENT ON INDEX idx_role_permissions_role_id IS
  'Resolve permissions for a role — RBAC authorization checks.';
