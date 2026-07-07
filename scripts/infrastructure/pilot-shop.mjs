#!/usr/bin/env node
/**
 * RetailX V2 Milestone D1.4 — Pilot shop enable/disable (rollback)
 *
 * Usage:
 *   node scripts/infrastructure/pilot-shop.mjs enable <shop_id> [--by email] [--notes text]
 *   node scripts/infrastructure/pilot-shop.mjs disable <shop_id>
 *   node scripts/infrastructure/pilot-shop.mjs status
 *   node scripts/infrastructure/pilot-shop.mjs list
 *
 * Rollback: `disable` immediately sets enabled=false — clients pick up within cache TTL (5s).
 * Instant kill-switch: set RETAILX_EMERGENCY_FORCE_V1=true (no deploy).
 */

import { resolveEnvironment, createClient, log } from './lib/helpers.mjs';

const args = process.argv.slice(2);
const command = args[0];
const shopId = args[1];

function parseOption(flag) {
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.split('=')[1];
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return undefined;
}

async function disableOtherPilots(client, exceptShopId) {
  await client.query(
    `UPDATE public.pilot_shops
     SET enabled = false, updated_at = now()
     WHERE enabled = true AND shop_id != $1::uuid`,
    [exceptShopId]
  );
}

async function cmdEnable(client) {
  if (!shopId) {
    console.error('Usage: pilot-shop.mjs enable <shop_id> [--by email] [--notes text]');
    process.exit(1);
  }

  const enabledBy = parseOption('--by') ?? process.env.USER ?? 'cli';
  const notes = parseOption('--notes') ?? 'Internal shop pilot D1.4';

  await disableOtherPilots(client, shopId);

  const result = await client.query(
    `INSERT INTO public.pilot_shops (shop_id, enabled, enabled_by, enabled_at, notes, updated_at)
     VALUES ($1::uuid, true, $2, now(), $3, now())
     ON CONFLICT (shop_id) DO UPDATE SET
       enabled = true,
       enabled_by = EXCLUDED.enabled_by,
       enabled_at = now(),
       notes = EXCLUDED.notes,
       updated_at = now()
     RETURNING shop_id, enabled, enabled_by, enabled_at`,
    [shopId, enabledBy, notes]
  );

  log('info', 'Pilot shop ENABLED', {
    shopId: result.rows[0].shop_id,
    enabledBy: result.rows[0].enabled_by,
    note: 'Only this shop uses membership auth. Global flag unchanged.',
  });
}

async function cmdDisable(client) {
  if (!shopId) {
    console.error('Usage: pilot-shop.mjs disable <shop_id>');
    process.exit(1);
  }

  const result = await client.query(
    `UPDATE public.pilot_shops
     SET enabled = false, updated_at = now()
     WHERE shop_id = $1::uuid
     RETURNING shop_id, enabled`,
    [shopId]
  );

  if (result.rowCount === 0) {
    log('warn', 'Pilot shop record not found — creating disabled record', { shopId });
    await client.query(
      `INSERT INTO public.pilot_shops (shop_id, enabled, notes, updated_at)
       VALUES ($1::uuid, false, 'rollback', now())
       ON CONFLICT (shop_id) DO NOTHING`,
      [shopId]
    );
  }

  log('info', 'Pilot shop DISABLED — shop reverts to V1 auth', {
    shopId,
    rollback: true,
    cacheTtlSeconds: 5,
    instantKillSwitch: 'RETAILX_EMERGENCY_FORCE_V1=true',
  });
}

async function cmdStatus(client) {
  const { rows } = await client.query(
    `SELECT shop_id, enabled, enabled_by, enabled_at, notes, updated_at
     FROM public.pilot_shops
     WHERE enabled = true
     ORDER BY enabled_at DESC
     LIMIT 1`
  );

  if (rows.length === 0) {
    log('info', 'No active pilot shops', { rollbackReady: true });
    return;
  }

  const row = rows[0];
  log('info', 'Active pilot shop', {
    shopId: row.shop_id,
    enabledBy: row.enabled_by,
    enabledAt: row.enabled_at,
    notes: row.notes,
    rollbackCommand: `npm run db:pilot -- disable ${row.shop_id}`,
  });
}

async function cmdList(client) {
  const { rows } = await client.query(
    `SELECT shop_id, enabled, enabled_by, enabled_at, notes, updated_at
     FROM public.pilot_shops
     ORDER BY updated_at DESC`
  );

  if (rows.length === 0) {
    log('info', 'No pilot shop records');
    return;
  }

  console.log(JSON.stringify(rows, null, 2));
}

async function main() {
  const env = resolveEnvironment(parseOption('--env'));
  const client = await createClient(env);

  try {
    switch (command) {
      case 'enable':
        await cmdEnable(client);
        break;
      case 'disable':
        await cmdDisable(client);
        break;
      case 'status':
        await cmdStatus(client);
        break;
      case 'list':
        await cmdList(client);
        break;
      default:
        console.error('Commands: enable | disable | status | list');
        process.exit(1);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  log('error', err.message ?? String(err));
  process.exit(1);
});
