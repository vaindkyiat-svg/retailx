#!/usr/bin/env node
/**
 * RetailX V2 — Toggle a feature flag in the database
 *
 * Usage:
 *   node scripts/infrastructure/toggle-flag.mjs USE_V2_PROVISIONING true
 *   node scripts/infrastructure/toggle-flag.mjs USE_MEMBERSHIP_AUTH false --env staging
 */

import {
  resolveEnvironment,
  createClient,
  log,
} from './lib/helpers.mjs';

const args = process.argv.slice(2);
const flagKey = args[0];
const enabledArg = args[1];
const envIdx = args.indexOf('--env');
const envFlag = args.find((a) => a.startsWith('--env='))?.split('=')[1]
  ?? (envIdx >= 0 ? args[envIdx + 1] : undefined);

const VALID_FLAGS = [
  'USE_V2_PROVISIONING',
  'USE_MEMBERSHIP_AUTH',
  'USE_MEMBERSHIP_RLS',
  'WRITE_LEGACY_CREDENTIALS',
  'USE_V2_CHECKOUT',
  'ENABLE_EDGE_FUNCTIONS',
];

async function main() {
  if (!flagKey || !VALID_FLAGS.includes(flagKey)) {
    console.error(`Usage: toggle-flag.mjs <flag> <true|false> [--env env]`);
    console.error(`Valid flags: ${VALID_FLAGS.join(', ')}`);
    process.exit(1);
  }

  const enabled = enabledArg === 'true' || enabledArg === '1';
  const env = resolveEnvironment(envFlag);
  const client = await createClient(env);

  try {
    const result = await client.query(
      `UPDATE public.feature_flags
       SET enabled = $1, updated_at = now()
       WHERE key = $2
       RETURNING key, enabled`,
      [enabled, flagKey]
    );

    if (result.rowCount === 0) {
      log('warn', `Flag not found: ${flagKey}. Run seeds first.`);
      process.exit(1);
    }

    log('info', `Flag updated`, { key: flagKey, enabled, environment: env });
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  log('error', err.message ?? String(err));
  process.exit(1);
});
