/**
 * RetailX V2 Milestone C1 — Backfill verification checks
 */

import { BACKFILL_BRANCH_CODE, BACKFILL_WAREHOUSE_CODE } from './mappings.mjs';

export async function runVerification(client) {
  const checks = [];
  const start = Date.now();

  async function check(name, sql, expectZero = true, detailSql) {
    const result = await client.query(sql);
    const count = parseInt(result.rows[0].count ?? result.rows[0].cnt ?? '0', 10);
    const passed = expectZero ? count === 0 : count > 0;
    let detail;

    if (detailSql && !passed) {
      const d = await client.query(detailSql);
      detail = `${count} issue(s): ${JSON.stringify(d.rows.slice(0, 3))}`;
    } else if (!passed) {
      detail = `${count} failing row(s)`;
    }

    checks.push({ name, passed, count, detail });
    return passed;
  }

  // Every shop has MAIN branch
  await check(
    'every_shop_has_main_branch',
    `SELECT count(*)::int AS count FROM public.shops s
     WHERE NOT EXISTS (
       SELECT 1 FROM public.branches b
       WHERE b.shop_id = s.id AND b.code = '${BACKFILL_BRANCH_CODE}' AND b.deleted_at IS NULL
     )`
  );

  // Every shop has DEFAULT warehouse
  await check(
    'every_shop_has_default_warehouse',
    `SELECT count(*)::int AS count FROM public.shops s
     WHERE NOT EXISTS (
       SELECT 1 FROM public.warehouses w
       WHERE w.shop_id = s.id AND w.code = '${BACKFILL_WAREHOUSE_CODE}' AND w.deleted_at IS NULL
     )`
  );

  // Every user_profile has membership
  await check(
    'every_user_profile_has_membership',
    `SELECT count(*)::int AS count FROM public.user_profiles up
     WHERE NOT EXISTS (
       SELECT 1 FROM public.memberships m
       WHERE m.user_id = up.id AND m.shop_id = up.shop_id AND m.deleted_at IS NULL
     )`
  );

  // Every shop with owner has at least one membership
  await check(
    'every_shop_with_owner_has_membership',
    `SELECT count(*)::int AS count FROM public.shops s
     WHERE EXISTS (SELECT 1 FROM public.user_profiles up WHERE up.shop_id = s.id)
       AND NOT EXISTS (
         SELECT 1 FROM public.memberships m
         WHERE m.shop_id = s.id AND m.deleted_at IS NULL
       )`,
    true
  );

  // Valid role FK on all memberships
  await check(
    'all_memberships_have_valid_role',
    `SELECT count(*)::int AS count FROM public.memberships m
     WHERE NOT EXISTS (SELECT 1 FROM public.system_roles r WHERE r.id = m.role_id)`
  );

  // No orphan memberships (invalid shop)
  await check(
    'no_orphan_memberships',
    `SELECT count(*)::int AS count FROM public.memberships m
     WHERE NOT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = m.shop_id)`
  );

  // No duplicate default branches per shop
  await check(
    'no_duplicate_default_branches',
    `SELECT count(*)::int AS count FROM (
       SELECT shop_id FROM public.branches
       WHERE is_default = true AND deleted_at IS NULL
       GROUP BY shop_id HAVING count(*) > 1
     ) dup`
  );

  // No duplicate primary owners per shop
  await check(
    'no_duplicate_primary_owners',
    `SELECT count(*)::int AS count FROM (
       SELECT shop_id FROM public.memberships
       WHERE is_primary = true AND deleted_at IS NULL AND status = 'active'
       GROUP BY shop_id HAVING count(*) > 1
     ) dup`
  );

  // Every shop has subscription
  await check(
    'every_shop_has_subscription',
    `SELECT count(*)::int AS count FROM public.shops s
     WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions sub WHERE sub.shop_id = s.id)`
  );

  // Valid plan FK on subscriptions
  await check(
    'all_subscriptions_have_valid_plan',
    `SELECT count(*)::int AS count FROM public.subscriptions sub
     WHERE NOT EXISTS (SELECT 1 FROM public.plans p WHERE p.id = sub.plan_id)`
  );

  // Warehouses linked to valid branch or null
  await check(
    'all_warehouses_have_valid_branch_fk',
    `SELECT count(*)::int AS count FROM public.warehouses w
     WHERE w.branch_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.branches b WHERE b.id = w.branch_id)`
  );

  // DEFAULT warehouses linked to MAIN branch
  await check(
    'default_warehouses_linked_to_main_branch',
    `SELECT count(*)::int AS count FROM public.warehouses w
     WHERE w.code = '${BACKFILL_WAREHOUSE_CODE}' AND w.deleted_at IS NULL
       AND (w.branch_id IS NULL OR NOT EXISTS (
         SELECT 1 FROM public.branches b
         WHERE b.id = w.branch_id AND b.code = '${BACKFILL_BRANCH_CODE}'
       ))`
  );

  const passedCount = checks.filter((c) => c.passed).length;
  const passed = passedCount === checks.length;

  return {
    passed,
    passedCount,
    totalCount: checks.length,
    checks,
    durationMs: Date.now() - start,
  };
}
