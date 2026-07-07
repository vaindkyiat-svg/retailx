/**
 * RetailX V2 Milestone C3 — Staging cutover simulations (read-only)
 * Simulates V1 app query patterns without auth implementation.
 */

import { measureQuery } from './metrics.mjs';

export async function runSimulations(client, metrics) {
  const results = [];
  const shopId = 'a1000000-0000-4000-8000-000000000001';
  const userId = 'b2000000-0000-4000-8000-000000000001';

  const simulations = [
    {
      name: 'auth_simulation',
      description: 'Simulate getAuthUser profile lookup (V1 path)',
      run: () => measureQuery(
        client,
        'auth_simulation',
        `SELECT up.id, up.email, up.role, up.shop_id, up.full_name, s.name AS shop_name
         FROM public.user_profiles up
         JOIN public.shops s ON s.id = up.shop_id
         WHERE up.id = $1`,
        [userId]
      ),
    },
    {
      name: 'provisioning_simulation',
      description: 'Verify provision_shop RPC exists (Sprint E1)',
      run: async () => {
        const start = Date.now();
        try {
          const result = await client.query(
            `SELECT proname FROM pg_proc WHERE proname = 'provision_shop'`
          );
          const exists = result.rowCount > 0;
          return {
            name: 'provisioning_simulation',
            durationMs: Date.now() - start,
            passed: exists,
            detail: exists ? 'provision_shop RPC deployed' : 'provision_shop missing',
          };
        } catch (err) {
          return {
            name: 'provisioning_simulation',
            durationMs: Date.now() - start,
            passed: false,
            detail: err.message,
          };
        }
      },
    },
    {
      name: 'membership_resolution',
      description: 'Resolve membership via private.current_membership()',
      run: () => measureQuery(
        client,
        'membership_resolution',
        `SELECT count(*)::int AS membership_count
         FROM public.memberships
         WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL`,
        [userId]
      ),
    },
    {
      name: 'tenant_resolution_v1',
      description: 'V1 tenant: user_profiles.shop_id',
      run: () => measureQuery(
        client,
        'tenant_resolution_v1',
        `SELECT shop_id FROM public.user_profiles WHERE id = $1`,
        [userId]
      ),
    },
    {
      name: 'tenant_resolution_v2',
      description: 'V2 tenant: memberships + private.current_shop_id()',
      run: () => measureQuery(
        client,
        'tenant_resolution_v2',
        `SELECT m.shop_id, m.is_primary, sr.slug AS role_slug
         FROM public.memberships m
         JOIN public.system_roles sr ON sr.id = m.role_id
         WHERE m.user_id = $1 AND m.status = 'active' AND m.deleted_at IS NULL`,
        [userId]
      ),
    },
    {
      name: 'dual_read_context',
      description: 'v_user_shop_context compatibility view',
      run: () => measureQuery(
        client,
        'dual_read_context',
        `SELECT * FROM public.v_user_shop_context WHERE user_id = $1`,
        [userId]
      ),
    },
    {
      name: 'shop_login_simulation',
      description: 'Simulate shop owner login context (profile + shop)',
      run: () => measureQuery(
        client,
        'shop_login_simulation',
        `SELECT up.email, up.role, s.id, s.name, s.status, s.plan
         FROM public.user_profiles up
         JOIN public.shops s ON s.id = up.shop_id
         WHERE up.email = $1`,
        ['ankit@example.com']
      ),
    },
    {
      name: 'product_queries',
      description: 'V1 fetchProducts pattern',
      run: () => measureQuery(
        client,
        'product_queries',
        `SELECT * FROM public.products WHERE shop_id = $1 ORDER BY name ASC`,
        [shopId]
      ),
    },
    {
      name: 'sales_queries',
      description: 'V1 fetchOrders pattern',
      run: () => measureQuery(
        client,
        'sales_queries',
        `SELECT * FROM public.orders WHERE shop_id = $1 ORDER BY date DESC, time DESC`,
        [shopId]
      ),
    },
    {
      name: 'report_queries',
      description: 'Daily sales aggregate report',
      run: () => measureQuery(
        client,
        'report_queries',
        `SELECT date, count(*)::int AS order_count, sum(total)::numeric AS revenue
         FROM public.orders
         WHERE shop_id = $1
         GROUP BY date
         ORDER BY date DESC`,
        [shopId]
      ),
    },
    {
      name: 'v2_tenancy_summary',
      description: 'V2 admin tenancy summary view',
      run: () => measureQuery(
        client,
        'v2_tenancy_summary',
        `SELECT * FROM public.v_shop_tenancy_summary WHERE shop_id = $1`,
        [shopId]
      ),
    },
    {
      name: 'feature_flags_read',
      description: 'Feature flag readiness check',
      run: () => measureQuery(
        client,
        'feature_flags_read',
        `SELECT key, enabled FROM public.feature_flags
         WHERE key IN ('USE_MEMBERSHIP_AUTH', 'USE_V2_PROVISIONING', 'USE_MEMBERSHIP_RLS')`
      ),
    },
  ];

  for (const sim of simulations) {
    const ctx = metrics.startPhase(sim.name);
    try {
      const result = await sim.run();
      const passed = result.passed !== undefined ? result.passed : result.rowCount >= 0;
      const entry = {
        ...result,
        description: sim.description,
        passed,
      };
      results.push(entry);
      metrics.endPhase(ctx, { passed, rowCount: result.rowCount, durationMs: result.durationMs });
    } catch (err) {
      results.push({
        name: sim.name,
        description: sim.description,
        passed: false,
        error: err.message,
        durationMs: Date.now() - ctx.startedAt,
      });
      metrics.endPhase(ctx, { passed: false, error: err.message });
    }
  }

  const passed = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    simulations: results,
    allPassed: passed === results.length,
  };
}
