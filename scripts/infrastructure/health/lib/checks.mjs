/**
 * RetailX V2 Milestone C2 — Health & integrity check definitions
 */

import { BACKFILL_BRANCH_CODE, BACKFILL_WAREHOUSE_CODE } from '../../backfill/lib/mappings.mjs';

const REQUIRED_SETTINGS = [
  'pos.currency_default',
  'pos.tax_rate_default',
];

const V2_RLS_TABLES = [
  'memberships', 'branches', 'warehouses', 'shop_settings',
  'subscriptions', 'invitations', 'user_devices', 'event_outbox', 'audit_logs',
];

const REQUIRED_INDEXES = [
  'idx_memberships_shop_id',
  'idx_memberships_user_id',
  'idx_branches_shop_id',
  'idx_warehouses_shop_id',
  'idx_subscriptions_shop_id',
];

/**
 * @typedef {Object} HealthCheck
 * @property {string} name
 * @property {string} category - memberships|branches|warehouses|settings|subscriptions|integrity|architecture|operations
 * @property {string} sql - returns { count: number }
 * @property {string} [detailSql]
 * @property {'error'|'warning'} severity
 * @property {string} [repair] - repair command key
 * @property {number} [weight] - score weight within category
 */

/** @type {HealthCheck[]} */
export const HEALTH_CHECKS = [
  // ─── Memberships ───
  {
    name: 'every_user_profile_has_membership',
    category: 'memberships',
    severity: 'error',
    repair: 'memberships',
    sql: `SELECT count(*)::int AS count FROM public.user_profiles up
          WHERE NOT EXISTS (
            SELECT 1 FROM public.memberships m
            WHERE m.user_id = up.id AND m.shop_id = up.shop_id AND m.deleted_at IS NULL
          )`,
  },
  {
    name: 'every_shop_with_owner_has_membership',
    category: 'memberships',
    severity: 'error',
    repair: 'memberships',
    sql: `SELECT count(*)::int AS count FROM public.shops s
          WHERE EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.shop_id = s.id)
            AND NOT EXISTS (
              SELECT 1 FROM public.memberships m
              WHERE m.shop_id = s.id AND m.deleted_at IS NULL
            )`,
  },
  {
    name: 'all_memberships_have_valid_role',
    category: 'memberships',
    severity: 'error',
    repair: 'memberships',
    sql: `SELECT count(*)::int AS count FROM public.memberships m
          WHERE NOT EXISTS (SELECT 1 FROM public.system_roles r WHERE r.id = m.role_id)`,
  },
  {
    name: 'all_memberships_have_valid_shop',
    category: 'memberships',
    severity: 'error',
    repair: 'memberships',
    sql: `SELECT count(*)::int AS count FROM public.memberships m
          WHERE NOT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = m.shop_id)`,
  },
  {
    name: 'all_memberships_have_valid_user',
    category: 'memberships',
    severity: 'error',
    repair: 'memberships',
    sql: `SELECT count(*)::int AS count FROM public.memberships m
          WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.id = m.user_id)`,
  },
  {
    name: 'no_duplicate_memberships',
    category: 'memberships',
    severity: 'error',
    repair: 'memberships',
    sql: `SELECT count(*)::int AS count FROM (
            SELECT user_id, shop_id FROM public.memberships
            WHERE deleted_at IS NULL GROUP BY user_id, shop_id HAVING count(*) > 1
          ) dup`,
  },
  {
    name: 'no_duplicate_primary_owners',
    category: 'memberships',
    severity: 'error',
    repair: 'defaults',
    sql: `SELECT count(*)::int AS count FROM (
            SELECT shop_id FROM public.memberships
            WHERE is_primary = true AND deleted_at IS NULL AND status = 'active'
            GROUP BY shop_id HAVING count(*) > 1
          ) dup`,
  },

  // ─── Branches ───
  {
    name: 'every_shop_has_default_branch',
    category: 'branches',
    severity: 'error',
    repair: 'branches',
    sql: `SELECT count(*)::int AS count FROM public.shops s
          WHERE NOT EXISTS (
            SELECT 1 FROM public.branches b
            WHERE b.shop_id = s.id AND b.is_default = true AND b.deleted_at IS NULL
          )`,
  },
  {
    name: 'every_shop_has_main_branch',
    category: 'branches',
    severity: 'error',
    repair: 'branches',
    sql: `SELECT count(*)::int AS count FROM public.shops s
          WHERE NOT EXISTS (
            SELECT 1 FROM public.branches b
            WHERE b.shop_id = s.id AND b.code = '${BACKFILL_BRANCH_CODE}' AND b.deleted_at IS NULL
          )`,
  },
  {
    name: 'all_branches_belong_to_valid_shop',
    category: 'branches',
    severity: 'error',
    repair: 'branches',
    sql: `SELECT count(*)::int AS count FROM public.branches b
          WHERE b.deleted_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = b.shop_id)`,
  },
  {
    name: 'no_multiple_default_branches',
    category: 'branches',
    severity: 'error',
    repair: 'defaults',
    sql: `SELECT count(*)::int AS count FROM (
            SELECT shop_id FROM public.branches
            WHERE is_default = true AND deleted_at IS NULL
            GROUP BY shop_id HAVING count(*) > 1
          ) dup`,
  },

  // ─── Warehouses ───
  {
    name: 'every_shop_has_default_warehouse',
    category: 'warehouses',
    severity: 'error',
    repair: 'warehouses',
    sql: `SELECT count(*)::int AS count FROM public.shops s
          WHERE NOT EXISTS (
            SELECT 1 FROM public.warehouses w
            WHERE w.shop_id = s.id AND w.is_default = true AND w.deleted_at IS NULL
          )`,
  },
  {
    name: 'every_shop_has_default_code_warehouse',
    category: 'warehouses',
    severity: 'error',
    repair: 'warehouses',
    sql: `SELECT count(*)::int AS count FROM public.shops s
          WHERE NOT EXISTS (
            SELECT 1 FROM public.warehouses w
            WHERE w.shop_id = s.id AND w.code = '${BACKFILL_WAREHOUSE_CODE}' AND w.deleted_at IS NULL
          )`,
  },
  {
    name: 'all_warehouses_belong_to_valid_shop',
    category: 'warehouses',
    severity: 'error',
    repair: 'warehouses',
    sql: `SELECT count(*)::int AS count FROM public.warehouses w
          WHERE w.deleted_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = w.shop_id)`,
  },
  {
    name: 'all_warehouses_have_valid_branch',
    category: 'warehouses',
    severity: 'error',
    repair: 'warehouses',
    sql: `SELECT count(*)::int AS count FROM public.warehouses w
          WHERE w.deleted_at IS NULL AND w.branch_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = w.branch_id)`,
  },
  {
    name: 'default_warehouses_linked_to_main_branch',
    category: 'warehouses',
    severity: 'error',
    repair: 'warehouses',
    sql: `SELECT count(*)::int AS count FROM public.warehouses w
          WHERE w.code = '${BACKFILL_WAREHOUSE_CODE}' AND w.deleted_at IS NULL
            AND (w.branch_id IS NULL OR NOT EXISTS (
              SELECT 1 FROM public.branches b
              WHERE b.id = w.branch_id AND b.code = '${BACKFILL_BRANCH_CODE}'
            ))`,
  },
  {
    name: 'no_multiple_default_warehouses',
    category: 'warehouses',
    severity: 'error',
    repair: 'defaults',
    sql: `SELECT count(*)::int AS count FROM (
            SELECT shop_id FROM public.warehouses
            WHERE is_default = true AND deleted_at IS NULL
            GROUP BY shop_id HAVING count(*) > 1
          ) dup`,
  },

  // ─── Settings ───
  {
    name: 'every_shop_has_required_settings',
    category: 'settings',
    severity: 'error',
    repair: 'settings',
    sql: `SELECT count(*)::int AS count FROM public.shops s
          WHERE NOT EXISTS (
            SELECT 1 FROM public.shop_settings ss
            WHERE ss.shop_id = s.id AND ss.key = 'pos.currency_default'
          )`,
  },
  {
    name: 'orphan_shop_settings',
    category: 'settings',
    severity: 'warning',
    repair: 'settings',
    sql: `SELECT count(*)::int AS count FROM public.shop_settings ss
          WHERE NOT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = ss.shop_id)`,
  },

  // ─── Subscriptions ───
  {
    name: 'every_shop_has_subscription',
    category: 'subscriptions',
    severity: 'error',
    repair: 'subscriptions',
    sql: `SELECT count(*)::int AS count FROM public.shops s
          WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions sub WHERE sub.shop_id = s.id)`,
  },
  {
    name: 'all_subscriptions_have_valid_plan',
    category: 'subscriptions',
    severity: 'error',
    repair: 'subscriptions',
    sql: `SELECT count(*)::int AS count FROM public.subscriptions sub
          WHERE NOT EXISTS (SELECT 1 FROM public.plans p WHERE p.id = sub.plan_id)`,
  },
  {
    name: 'no_subscriptions_on_inactive_plans',
    category: 'subscriptions',
    severity: 'warning',
    repair: 'subscriptions',
    sql: `SELECT count(*)::int AS count FROM public.subscriptions sub
          JOIN public.plans p ON p.id = sub.plan_id
          WHERE sub.status = 'active' AND p.is_active = false`,
  },
  {
    name: 'orphan_subscriptions',
    category: 'subscriptions',
    severity: 'error',
    repair: 'subscriptions',
    sql: `SELECT count(*)::int AS count FROM public.subscriptions sub
          WHERE NOT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = sub.shop_id)`,
  },

  // ─── Integrity / Operations ───
  {
    name: 'dangling_pending_invitations',
    category: 'operations',
    severity: 'warning',
    repair: null,
    sql: `SELECT count(*)::int AS count FROM public.invitations i
          WHERE i.status = 'pending' AND i.expires_at < now()
            AND NOT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = i.shop_id)`,
  },
  {
    name: 'expired_pending_invitations',
    category: 'operations',
    severity: 'warning',
    repair: null,
    sql: `SELECT count(*)::int AS count FROM public.invitations
          WHERE status = 'pending' AND expires_at < now()`,
  },
  {
    name: 'stale_untrusted_devices',
    category: 'operations',
    severity: 'warning',
    repair: null,
    sql: `SELECT count(*)::int AS count FROM public.user_devices
          WHERE is_trusted = false AND last_seen_at < now() - interval '90 days'`,
  },
  {
    name: 'outbox_stuck_processing',
    category: 'operations',
    severity: 'warning',
    repair: null,
    sql: `SELECT count(*)::int AS count FROM public.event_outbox
          WHERE status = 'processing' AND updated_at < now() - interval '1 hour'`,
  },
  {
    name: 'outbox_failed_without_error',
    category: 'operations',
    severity: 'warning',
    repair: null,
    sql: `SELECT count(*)::int AS count FROM public.event_outbox
          WHERE status = 'failed' AND (error_message IS NULL OR error_message = '')`,
  },
  {
    name: 'audit_logs_orphan_shop',
    category: 'operations',
    severity: 'warning',
    repair: null,
    sql: `SELECT count(*)::int AS count FROM public.audit_logs al
          WHERE al.shop_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = al.shop_id)`,
  },
];

/** Architecture checks — run separately (boolean/meta checks) */
export const ARCHITECTURE_CHECKS = [
  {
    name: 'rls_enabled_v2_tables',
    category: 'architecture',
    severity: 'error',
    repair: null,
  },
  {
    name: 'required_indexes_exist',
    category: 'architecture',
    severity: 'error',
    repair: null,
  },
];

export { V2_RLS_TABLES, REQUIRED_INDEXES, REQUIRED_SETTINGS };

export async function runHealthChecks(client, { full = true } = {}) {
  const start = Date.now();
  const results = [];

  const checksToRun = full
    ? HEALTH_CHECKS
    : HEALTH_CHECKS.filter((c) => c.severity === 'error' && c.category !== 'operations');

  for (const def of checksToRun) {
    try {
      const result = await client.query(def.sql);
      const count = parseInt(result.rows[0].count ?? '0', 10);
      let detail;

      if (count > 0 && def.detailSql) {
        const d = await client.query(def.detailSql);
        detail = JSON.stringify(d.rows.slice(0, 5));
      } else if (count > 0) {
        detail = `${count} issue(s)`;
      }

      results.push({
        name: def.name,
        category: def.category,
        severity: def.severity,
        passed: count === 0,
        count,
        detail,
        repair: def.repair,
      });
    } catch (err) {
      results.push({
        name: def.name,
        category: def.category,
        severity: 'error',
        passed: false,
        count: -1,
        detail: err.message,
        repair: def.repair,
      });
    }
  }

  return { checks: results, durationMs: Date.now() - start };
}

export async function runArchitectureChecks(client) {
  const results = [];

  // RLS enabled
  const rls = await client.query(
    `SELECT c.relname, c.relrowsecurity
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = ANY($1::text[])`,
    [V2_RLS_TABLES]
  );
  const missingRls = V2_RLS_TABLES.filter(
    (t) => !rls.rows.find((r) => r.relname === t && r.relrowsecurity)
  );
  results.push({
    name: 'rls_enabled_v2_tables',
    category: 'architecture',
    severity: 'error',
    passed: missingRls.length === 0,
    count: missingRls.length,
    detail: missingRls.length ? `Missing RLS: ${missingRls.join(', ')}` : null,
    repair: null,
  });

  // Required indexes
  const idx = await client.query(
    `SELECT indexname FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
    [REQUIRED_INDEXES]
  );
  const found = new Set(idx.rows.map((r) => r.indexname));
  const missingIdx = REQUIRED_INDEXES.filter((i) => !found.has(i));
  results.push({
    name: 'required_indexes_exist',
    category: 'architecture',
    severity: 'error',
    passed: missingIdx.length === 0,
    count: missingIdx.length,
    detail: missingIdx.length ? `Missing: ${missingIdx.join(', ')}` : null,
    repair: null,
  });

  return results;
}
