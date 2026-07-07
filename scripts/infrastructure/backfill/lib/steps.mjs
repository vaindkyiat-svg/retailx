/**
 * RetailX V2 Milestone C1 — Backfill step implementations
 */

import {
  V1_ROLE_TO_V2_SLUG,
  mapLegacyPlanToCode,
  DEFAULT_SHOP_SETTINGS,
  BACKFILL_BRANCH_CODE,
  BACKFILL_BRANCH_NAME,
  BACKFILL_WAREHOUSE_CODE,
  BACKFILL_WAREHOUSE_NAME,
} from './mappings.mjs';
import { initStep, finalizeStep } from './report.mjs';

async function loadRoleMap(client) {
  const result = await client.query(`SELECT id, slug FROM public.system_roles`);
  const map = new Map();
  for (const row of result.rows) map.set(row.slug, row.id);
  return map;
}

async function writeAudit(client, { shopId, userId, action, entityType, entityId, metadata, runId }) {
  try {
    await client.query(
      `INSERT INTO public.audit_logs
         (shop_id, user_id, action, entity_type, entity_id, new_values, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        shopId ?? null,
        userId ?? null,
        action,
        entityType,
        entityId,
        JSON.stringify({ source: 'milestone_c1_backfill', run_id: runId }),
        JSON.stringify({ milestone: 'C1', run_id: runId, ...(metadata ?? {}) }),
      ]
    );
  } catch {
    // audit_logs optional if Milestone B not fully applied
  }
}

export async function backfillMemberships(client, runId) {
  const step = initStep('memberships');
  const roleMap = await loadRoleMap(client);

  const profiles = await client.query(
    `SELECT id, email, role, shop_id, created_at
     FROM public.user_profiles
     ORDER BY created_at ASC`
  );

  step.processed = profiles.rows.length;
  const primarySetPerShop = new Set();

  for (const profile of profiles.rows) {
    const v2Slug = V1_ROLE_TO_V2_SLUG[profile.role] ?? 'shop_owner';
    const roleId = roleMap.get(v2Slug);

    if (!roleId) {
      step.errors.push(`Missing system_role slug: ${v2Slug} for user ${profile.id}`);
      continue;
    }

    const isPrimary = !primarySetPerShop.has(profile.shop_id) && v2Slug === 'shop_owner';
    if (isPrimary) primarySetPerShop.add(profile.shop_id);

    const existing = await client.query(
      `SELECT id FROM public.memberships
       WHERE user_id = $1 AND shop_id = $2`,
      [profile.id, profile.shop_id]
    );

    if (existing.rows.length > 0) {
      step.skipped++;
      continue;
    }

    const inserted = await client.query(
      `INSERT INTO public.memberships
         (user_id, shop_id, role_id, status, is_primary, joined_at)
       VALUES ($1, $2, $3, 'active', $4, COALESCE($5, now()))
       RETURNING id`,
      [profile.id, profile.shop_id, roleId, isPrimary, profile.created_at]
    );

    step.inserted++;
    await writeAudit(client, {
      shopId: profile.shop_id,
      userId: profile.id,
      action: 'create',
      entityType: 'membership',
      entityId: inserted.rows[0].id,
      runId,
      metadata: { v1_role: profile.role, v2_slug: v2Slug },
    });
  }

  const shopsWithoutOwner = await client.query(
    `SELECT s.id, s.name
     FROM public.shops s
     WHERE NOT EXISTS (
       SELECT 1 FROM public.user_profiles up WHERE up.shop_id = s.id
     )`
  );

  if (shopsWithoutOwner.rows.length > 0) {
    step.warnings.push(
      `${shopsWithoutOwner.rows.length} shop(s) have no user_profiles — membership not created`
    );
    step.details.shopsWithoutOwner = shopsWithoutOwner.rows.map((r) => r.id);
  }

  step.details.primaryOwners = primarySetPerShop.size;
  return finalizeStep(step);
}

export async function backfillBranches(client, runId) {
  const step = initStep('branches');

  const shops = await client.query(
    `SELECT id, name, address, city, state, owner_phone
     FROM public.shops
     ORDER BY created_at ASC`
  );

  step.processed = shops.rows.length;

  for (const shop of shops.rows) {
    const existing = await client.query(
      `SELECT id FROM public.branches
       WHERE shop_id = $1 AND code = $2 AND deleted_at IS NULL`,
      [shop.id, BACKFILL_BRANCH_CODE]
    );

    if (existing.rows.length > 0) {
      step.skipped++;
      continue;
    }

    const inserted = await client.query(
      `INSERT INTO public.branches
         (shop_id, name, code, address, city, state, phone, status, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', true)
       RETURNING id`,
      [
        shop.id,
        BACKFILL_BRANCH_NAME,
        BACKFILL_BRANCH_CODE,
        shop.address,
        shop.city,
        shop.state,
        shop.owner_phone,
      ]
    );

    step.inserted++;
    await writeAudit(client, {
      shopId: shop.id,
      action: 'create',
      entityType: 'branch',
      entityId: inserted.rows[0].id,
      runId,
      metadata: { code: BACKFILL_BRANCH_CODE },
    });
  }

  return finalizeStep(step);
}

export async function backfillWarehouses(client, runId) {
  const step = initStep('warehouses');

  const shops = await client.query(`SELECT id FROM public.shops ORDER BY created_at ASC`);
  step.processed = shops.rows.length;

  for (const shop of shops.rows) {
    const branch = await client.query(
      `SELECT id FROM public.branches
       WHERE shop_id = $1 AND code = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [shop.id, BACKFILL_BRANCH_CODE]
    );

    if (branch.rows.length === 0) {
      step.warnings.push(`Shop ${shop.id} has no MAIN branch — warehouse skipped`);
      step.skipped++;
      continue;
    }

    const existing = await client.query(
      `SELECT id FROM public.warehouses
       WHERE shop_id = $1 AND code = $2 AND deleted_at IS NULL`,
      [shop.id, BACKFILL_WAREHOUSE_CODE]
    );

    if (existing.rows.length > 0) {
      step.skipped++;
      continue;
    }

    const inserted = await client.query(
      `INSERT INTO public.warehouses
         (shop_id, branch_id, name, code, status, is_default)
       VALUES ($1, $2, $3, $4, 'active', true)
       RETURNING id`,
      [shop.id, branch.rows[0].id, BACKFILL_WAREHOUSE_NAME, BACKFILL_WAREHOUSE_CODE]
    );

    step.inserted++;
    await writeAudit(client, {
      shopId: shop.id,
      action: 'create',
      entityType: 'warehouse',
      entityId: inserted.rows[0].id,
      runId,
      metadata: { code: BACKFILL_WAREHOUSE_CODE, branch_id: branch.rows[0].id },
    });
  }

  return finalizeStep(step);
}

export async function backfillShopSettings(client, runId) {
  const step = initStep('shop_settings');

  const shops = await client.query(`SELECT id, plan FROM public.shops ORDER BY created_at ASC`);
  step.processed = shops.rows.length * (DEFAULT_SHOP_SETTINGS.length + 2);

  for (const shop of shops.rows) {
    const settings = [
      ...DEFAULT_SHOP_SETTINGS,
      { key: 'legacy.plan_text', value: shop.plan ?? 'standard' },
      { key: 'onboarding.v2_backfill_completed', value: true },
    ];

    for (const setting of settings) {
      const result = await client.query(
        `INSERT INTO public.shop_settings (shop_id, key, value)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (shop_id, key) DO NOTHING
         RETURNING id`,
        [shop.id, setting.key, JSON.stringify(setting.value)]
      );

      if (result.rows.length > 0) {
        step.inserted++;
        await writeAudit(client, {
          shopId: shop.id,
          action: 'create',
          entityType: 'shop_setting',
          entityId: result.rows[0].id,
          runId,
          metadata: { key: setting.key },
        });
      } else {
        step.skipped++;
      }
    }
  }

  return finalizeStep(step);
}

export async function backfillSubscriptions(client, runId) {
  const step = initStep('subscriptions');

  const shops = await client.query(
    `SELECT id, plan, created_at, status FROM public.shops ORDER BY created_at ASC`
  );
  step.processed = shops.rows.length;

  const plans = await client.query(`SELECT id, code FROM public.plans WHERE is_active = true`);
  const planMap = new Map(plans.rows.map((p) => [p.code, p.id]));

  for (const shop of shops.rows) {
    const planCode = mapLegacyPlanToCode(shop.plan);
    const planId = planMap.get(planCode);

    if (!planId) {
      step.errors.push(`No active plan for code "${planCode}" (shop ${shop.id})`);
      continue;
    }

    const existing = await client.query(
      `SELECT id FROM public.subscriptions WHERE shop_id = $1`,
      [shop.id]
    );

    if (existing.rows.length > 0) {
      step.skipped++;
      continue;
    }

    const subStatus = shop.status === 'cancelled' ? 'cancelled' : 'active';

    const inserted = await client.query(
      `INSERT INTO public.subscriptions
         (shop_id, plan_id, status, current_period_start)
       VALUES ($1, $2, $3, COALESCE($4, now()))
       RETURNING id`,
      [shop.id, planId, subStatus, shop.created_at]
    );

    step.inserted++;
    if (!step.details.planMappings) step.details.planMappings = {};
    step.details.planMappings[shop.id] = { legacyPlan: shop.plan, v2PlanCode: planCode };

    await writeAudit(client, {
      shopId: shop.id,
      action: 'create',
      entityType: 'subscription',
      entityId: inserted.rows[0].id,
      runId,
      metadata: { legacy_plan: shop.plan, v2_plan_code: planCode },
    });
  }

  return finalizeStep(step);
}

export async function recordBackfillRun(client, report, environment) {
  const exists = await client.query(
    `SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'backfill_runs'
    )`
  );

  if (!exists.rows[0].exists) return;

  await client.query(
    `INSERT INTO public.backfill_runs
       (run_id, milestone, environment, status, completed_at, duration_ms, report, error_message)
     VALUES ($1, 'C1', $2, $3, $4, $5, $6, $7)
     ON CONFLICT (run_id) DO UPDATE SET
       status = EXCLUDED.status,
       completed_at = EXCLUDED.completed_at,
       duration_ms = EXCLUDED.duration_ms,
       report = EXCLUDED.report,
       error_message = EXCLUDED.error_message`,
    [
      report.runId,
      environment,
      report.status,
      report.completedAt,
      report.durationMs,
      JSON.stringify(report),
      report.errors.length > 0 ? report.errors.join('; ') : null,
    ]
  );
}
