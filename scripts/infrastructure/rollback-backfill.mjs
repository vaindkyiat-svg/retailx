#!/usr/bin/env node
/**
 * RetailX V2 Milestone C1 — Roll back backfill data (development only)
 *
 * Removes only rows created by C1 backfill (identified by MAIN/DEFAULT codes
 * and audit log source). Does NOT touch V1 tables.
 */

import {
  createClient,
  resolveEnvironment,
  withTransaction,
  log,
  loadEnvironments,
} from './lib/helpers.mjs';
import {
  BACKFILL_BRANCH_CODE,
  BACKFILL_WAREHOUSE_CODE,
} from './backfill/lib/mappings.mjs';

const args = process.argv.slice(2);
const envFlag = args.find((a) => a.startsWith('--env='))?.split('=')[1]
  ?? args[args.indexOf('--env') + 1];

const DEFAULT_SETTING_KEYS = [
  'pos.currency_default',
  'pos.tax_rate_default',
  'pos.receipt_footer',
  'onboarding.completed',
  'legacy.plan_source',
  'legacy.plan_text',
  'onboarding.v2_backfill_completed',
];

async function main() {
  const env = resolveEnvironment(envFlag);
  const config = loadEnvironments()[env];

  if (env === 'production') {
    log('error', 'Backfill rollback is disabled in production');
    process.exit(1);
  }

  const client = await createClient(env);
  const report = { deleted: {} };

  try {
    await withTransaction(client, async (tx) => {
      const subs = await tx.query(
        `DELETE FROM public.subscriptions sub
         WHERE EXISTS (
           SELECT 1 FROM public.audit_logs al
           WHERE al.entity_type = 'subscription'
             AND al.entity_id = sub.id::text
             AND al.metadata->>'milestone' = 'C1'
         )
         RETURNING id`
      );
      report.deleted.subscriptions = subs.rowCount;

      const settings = await tx.query(
        `DELETE FROM public.shop_settings
         WHERE key = ANY($1::text[])
         RETURNING id`,
        [DEFAULT_SETTING_KEYS]
      );
      report.deleted.shop_settings = settings.rowCount;

      const warehouses = await tx.query(
        `DELETE FROM public.warehouses
         WHERE code = $1
         RETURNING id`,
        [BACKFILL_WAREHOUSE_CODE]
      );
      report.deleted.warehouses = warehouses.rowCount;

      const branches = await tx.query(
        `DELETE FROM public.branches
         WHERE code = $1
         RETURNING id`,
        [BACKFILL_BRANCH_CODE]
      );
      report.deleted.branches = branches.rowCount;

      const memberships = await tx.query(
        `DELETE FROM public.memberships m
         WHERE EXISTS (
           SELECT 1 FROM public.audit_logs al
           WHERE al.entity_type = 'membership'
             AND al.entity_id = m.id::text
             AND al.metadata->>'milestone' = 'C1'
         )
         RETURNING id`
      );
      report.deleted.memberships = memberships.rowCount;

      const audits = await tx.query(
        `DELETE FROM public.audit_logs
         WHERE metadata->>'milestone' = 'C1'
         RETURNING id`
      );
      report.deleted.audit_logs = audits.rowCount;

      if (config.allowDestructiveSeed !== false) {
        await tx.query(
          `UPDATE public.backfill_runs SET status = 'rolled_back'
           WHERE milestone = 'C1' AND status = 'completed'`
        );
      }
    });

    log('info', 'Backfill rollback complete', report);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  log('error', err.message ?? String(err));
  process.exit(1);
});
