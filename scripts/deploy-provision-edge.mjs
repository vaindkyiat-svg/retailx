#!/usr/bin/env node
/**
 * Deploy provision-shop edge function + secrets + verify (Steps 1–2)
 *
 * Requires:
 *   - Supabase CLI logged into account with access to project xheaeamycsqdwdezrixr
 *   - OR SUPABASE_ACCESS_TOKEN env var with project deploy privileges
 *
 * Usage:
 *   node scripts/deploy-provision-edge.mjs
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const PROJECT_REF = 'xheaeamycsqdwdezrixr';

function loadEnvLocal() {
  const path = join(ROOT, '.env.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i <= 0) continue;
    const key = trimmed.slice(0, i).trim();
    const value = trimmed.slice(i + 1).trim();
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function run(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: process.env,
    ...opts,
  });
  if (result.status !== 0) {
    throw new Error(`Command failed (${result.status}): ${cmd} ${args.join(' ')}`);
  }
}

async function verifyFunction() {
  const url = `${process.env.VITE_SUPABASE_URL}/functions/v1/provision-shop`;
  console.log(`\n> curl ${url}`);
  const res = await fetch(url, { method: 'OPTIONS' });
  const text = await res.text();
  console.log(`Status: ${res.status}`);
  if (text) console.log(text.slice(0, 500));
  if (res.status === 404) {
    throw new Error('Still 404 — function not deployed');
  }
  console.log('✓ Function endpoint reachable (not 404)');
}

async function main() {
  loadEnvLocal();

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD ?? 'RetailX2026Secure';

  if (!supabaseUrl || !serviceRole) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  if (!process.env.SUPABASE_ACCESS_TOKEN) {
    console.warn(
      'SUPABASE_ACCESS_TOKEN not set. Ensure `supabase login` uses the account that owns project',
      PROJECT_REF
    );
  }

  run('npx', ['supabase', 'link', `--project-ref=${PROJECT_REF}`, `-p`, dbPassword, '--yes']);
  run('npx', ['supabase', 'functions', 'deploy', 'provision-shop', `--project-ref=${PROJECT_REF}`, '--yes']);
  run('npx', [
    'supabase',
    'secrets',
    'set',
    `SUPABASE_URL=${supabaseUrl}`,
    `SUPABASE_SERVICE_ROLE_KEY=${serviceRole}`,
    `--project-ref=${PROJECT_REF}`,
  ]);

  await verifyFunction();
  console.log('\nSteps 1–2 complete. Next: npm run db:flag -- USE_V2_PROVISIONING true');
}

main().catch((err) => {
  console.error('\nDeploy failed:', err.message);
  console.error(`
If you see 403 privileges error, the Supabase CLI is logged into the wrong account.

Fix:
  npx supabase logout
  npx supabase login          # use the account that owns ${PROJECT_REF}
  node scripts/deploy-provision-edge.mjs

Or set SUPABASE_ACCESS_TOKEN from https://supabase.com/dashboard/account/tokens
`);
  process.exit(1);
});
