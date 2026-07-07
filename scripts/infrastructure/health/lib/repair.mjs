/**
 * RetailX V2 Milestone C2 — Safe repair engine (dry-run supported)
 */

import {
  backfillMemberships,
  backfillBranches,
  backfillWarehouses,
  backfillShopSettings,
  backfillSubscriptions,
} from '../../backfill/lib/steps.mjs';
import { BACKFILL_BRANCH_CODE, BACKFILL_WAREHOUSE_CODE } from '../../backfill/lib/mappings.mjs';
import { initStep, finalizeStep } from '../../backfill/lib/report.mjs';

export const REPAIR_TARGETS = [
  'memberships',
  'branches',
  'warehouses',
  'settings',
  'subscriptions',
  'defaults',
  'all',
];

const REPAIR_FN = {
  memberships: backfillMemberships,
  branches: backfillBranches,
  warehouses: backfillWarehouses,
  settings: backfillShopSettings,
  subscriptions: backfillSubscriptions,
};

export async function repairDefaults(client, runId, dryRun) {
  const step = initStep('repair_defaults');
  step.processed = 0;
  step.inserted = 0;
  step.skipped = 0;

  const dupBranches = await client.query(
    `SELECT shop_id, array_agg(id ORDER BY created_at ASC) AS ids
     FROM public.branches
     WHERE is_default = true AND deleted_at IS NULL
     GROUP BY shop_id HAVING count(*) > 1`
  );

  const dupWarehouses = await client.query(
    `SELECT shop_id, array_agg(id ORDER BY created_at ASC) AS ids
     FROM public.warehouses
     WHERE is_default = true AND deleted_at IS NULL
     GROUP BY shop_id HAVING count(*) > 1`
  );

  const dupPrimary = await client.query(
    `SELECT shop_id, array_agg(id ORDER BY joined_at ASC) AS ids
     FROM public.memberships
     WHERE is_primary = true AND deleted_at IS NULL AND status = 'active'
     GROUP BY shop_id HAVING count(*) > 1`
  );

  step.processed = dupBranches.rows.length + dupWarehouses.rows.length + dupPrimary.rows.length;

  for (const row of dupBranches.rows) {
    const keepId = row.ids[0];
    const demoteIds = row.ids.slice(1);
    step.details[`branch_shop_${row.shop_id}`] = { keep: keepId, demote: demoteIds };
    if (!dryRun) {
      await client.query(
        `UPDATE public.branches SET is_default = false, updated_at = now()
         WHERE id = ANY($1::uuid[])`,
        [demoteIds]
      );
    }
    step.inserted++;
  }

  for (const row of dupWarehouses.rows) {
    const keepId = row.ids[0];
    const demoteIds = row.ids.slice(1);
    if (!dryRun) {
      await client.query(
        `UPDATE public.warehouses SET is_default = false, updated_at = now()
         WHERE id = ANY($1::uuid[])`,
        [demoteIds]
      );
    }
    step.inserted++;
  }

  for (const row of dupPrimary.rows) {
    const keepId = row.ids[0];
    const demoteIds = row.ids.slice(1);
    if (!dryRun) {
      await client.query(
        `UPDATE public.memberships SET is_primary = false, updated_at = now()
         WHERE id = ANY($1::uuid[])`,
        [demoteIds]
      );
    }
    step.inserted++;
  }

  if (step.processed === 0) step.skipped = 1;
  return finalizeStep(step);
}

export async function runRepair(client, target, runId, dryRun = false) {
  const report = {
    runId,
    target,
    dryRun,
    startedAt: new Date().toISOString(),
    steps: {},
  };

  const targets = target === 'all'
    ? ['memberships', 'branches', 'warehouses', 'settings', 'subscriptions', 'defaults']
    : [target];

  for (const t of targets) {
    if (t === 'defaults') {
      report.steps.defaults = await repairDefaults(client, runId, dryRun);
    } else if (REPAIR_FN[t]) {
      if (dryRun) {
        const step = initStep(`dry_run_${t}`);
        const preview = await previewRepair(client, t);
        step.processed = preview.processed;
        step.inserted = preview.wouldInsert;
        step.skipped = preview.wouldSkip;
        step.details = preview.details;
        report.steps[t] = finalizeStep(step);
      } else {
        report.steps[t] = await REPAIR_FN[t](client, runId);
      }
    }
  }

  report.completedAt = new Date().toISOString();
  report.durationMs = new Date(report.completedAt) - new Date(report.startedAt);
  report.summary = summarizeRepair(report.steps);

  return report;
}

async function previewRepair(client, target) {
  const details = {};

  if (target === 'memberships') {
    const r = await client.query(
      `SELECT count(*)::int AS would_insert FROM public.user_profiles up
       WHERE NOT EXISTS (
         SELECT 1 FROM public.memberships m
         WHERE m.user_id = up.id AND m.shop_id = up.shop_id
       )`
    );
    const total = await client.query(`SELECT count(*)::int AS c FROM public.user_profiles`);
    return {
      processed: total.rows[0].c,
      wouldInsert: r.rows[0].would_insert,
      wouldSkip: total.rows[0].c - r.rows[0].would_insert,
      details,
    };
  }

  if (target === 'branches') {
    const r = await client.query(
      `SELECT count(*)::int AS would_insert FROM public.shops s
       WHERE NOT EXISTS (
         SELECT 1 FROM public.branches b
         WHERE b.shop_id = s.id AND b.code = '${BACKFILL_BRANCH_CODE}' AND b.deleted_at IS NULL
       )`
    );
    const total = await client.query(`SELECT count(*)::int AS c FROM public.shops`);
    return {
      processed: total.rows[0].c,
      wouldInsert: r.rows[0].would_insert,
      wouldSkip: total.rows[0].c - r.rows[0].would_insert,
      details,
    };
  }

  if (target === 'warehouses') {
    const r = await client.query(
      `SELECT count(*)::int AS would_insert FROM public.shops s
       WHERE NOT EXISTS (
         SELECT 1 FROM public.warehouses w
         WHERE w.shop_id = s.id AND w.code = '${BACKFILL_WAREHOUSE_CODE}' AND w.deleted_at IS NULL
       )`
    );
    const total = await client.query(`SELECT count(*)::int AS c FROM public.shops`);
    return {
      processed: total.rows[0].c,
      wouldInsert: r.rows[0].would_insert,
      wouldSkip: total.rows[0].c - r.rows[0].would_insert,
      details,
    };
  }

  if (target === 'subscriptions') {
    const r = await client.query(
      `SELECT count(*)::int AS would_insert FROM public.shops s
       WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions sub WHERE sub.shop_id = s.id)`
    );
    const total = await client.query(`SELECT count(*)::int AS c FROM public.shops`);
    return {
      processed: total.rows[0].c,
      wouldInsert: r.rows[0].would_insert,
      wouldSkip: total.rows[0].c - r.rows[0].would_insert,
      details,
    };
  }

  if (target === 'settings') {
    const r = await client.query(
      `SELECT count(*)::int AS would_insert FROM public.shops s
       WHERE NOT EXISTS (
         SELECT 1 FROM public.shop_settings ss
         WHERE ss.shop_id = s.id AND ss.key = 'pos.currency_default'
       )`
    );
    const total = await client.query(`SELECT count(*)::int AS c FROM public.shops`);
    return {
      processed: total.rows[0].c,
      wouldInsert: r.rows[0].would_insert,
      wouldSkip: total.rows[0].c - r.rows[0].would_insert,
      details,
    };
  }

  return { processed: 0, wouldInsert: 0, wouldSkip: 0, details };
}

function summarizeRepair(steps) {
  let processed = 0;
  let inserted = 0;
  let skipped = 0;
  for (const step of Object.values(steps)) {
    processed += step.processed ?? 0;
    inserted += step.inserted ?? 0;
    skipped += step.skipped ?? 0;
  }
  return { processed, inserted, skipped };
}
