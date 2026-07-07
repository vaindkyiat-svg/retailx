#!/usr/bin/env node
/**
 * Bootstrap minimal V1 tables for migration testing (CI/local)
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, resolveEnvironment, getProjectRoot, log } from './lib/helpers.mjs';

const args = process.argv.slice(2);
const envFlag = args.find((a) => a.startsWith('--env='))?.split('=')[1]
  ?? args[args.indexOf('--env') + 1];

async function main() {
  const env = resolveEnvironment(envFlag);
  const sql = readFileSync(
    join(getProjectRoot(), 'supabase', 'tests', 'bootstrap', 'v1_minimal.sql'),
    'utf8'
  );
  const client = await createClient(env);
  try {
    await client.query(sql);
    log('info', 'V1 bootstrap complete', { environment: env });
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  log('error', err.message ?? String(err));
  process.exit(1);
});
