#!/usr/bin/env node
/**
 * RetailX V2 Milestone D1.4A — Release rollout evaluation CLI
 *
 * Usage:
 *   node scripts/infrastructure/release-evaluate.mjs
 *   node scripts/infrastructure/release-evaluate.mjs --shop <uuid> --approved-by ops@retailx.internal
 *
 * Evaluates release gates only — does NOT enable pilot.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveEnvironment, createClient, log, getProjectRoot } from './lib/helpers.mjs';

const args = process.argv.slice(2);

function parseOption(flag) {
  const eq = args.find((a) => a.startsWith(`${flag}=`));
  if (eq) return eq.split('=')[1];
  const idx = args.indexOf(flag);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return undefined;
}

async function fetchHealthScore(client) {
  try {
    const result = await client.query(
      `SELECT score FROM public.health_scores ORDER BY created_at DESC LIMIT 1`
    );
    return result.rows[0]?.score ?? 100;
  } catch {
    return 100;
  }
}

async function main() {
  const env = resolveEnvironment(parseOption('--env'));
  const shopId = parseOption('--shop') ?? null;
  const approvedBy = parseOption('--approved-by') ?? 'cli';

  const root = getProjectRoot();
  const archResult = spawnSync(process.execPath, ['scripts/infrastructure/validate-auth-architecture.mjs'], {
    cwd: root,
    encoding: 'utf8',
  });
  const architectureValidationPassed = archResult.status === 0;

  let healthScore = 100;
  let databaseHealthOk = true;

  if (process.env.DATABASE_URL || process.env.RETAILX_DATABASE_URL) {
    try {
      const client = await createClient(env);
      try {
        healthScore = await fetchHealthScore(client);
        await client.query('SELECT 1');
      } finally {
        await client.end();
      }
    } catch (err) {
      databaseHealthOk = false;
      log('warn', 'Database health check failed', { message: err.message });
    }
  }

  // Gate evaluation using documented defaults (mirrors DEFAULT_RELEASE_GATE_CONFIG)
  const gateConfigPath = join(root, 'src/lib/auth/release/ReleaseGate.ts');
  if (!existsSync(gateConfigPath)) {
    log('error', 'Release gate config not found');
    process.exit(1);
  }

  log('info', 'Release evaluation context', {
    shopId,
    approvedBy,
    architectureValidationPassed,
    databaseHealthOk,
    healthScore,
    note: 'Run vitest RolloutController tests for full gate evaluation. CLI records ops context only.',
  });

  if (!architectureValidationPassed) {
    log('error', 'Architecture validation FAILED — decision: BLOCK', {
      stderr: archResult.stderr,
    });
    process.exit(2);
  }

  if (process.env.RETAILX_EMERGENCY_FORCE_V1 === 'true') {
    log('error', 'Emergency override active — decision: BLOCK');
    process.exit(3);
  }

  log('info', 'Architecture validation PASSED — ready for in-app RolloutController.evaluate()', {
    dashboard: 'getReleaseDashboardReport()',
    rollback: shopId ? `npm run db:pilot -- disable ${shopId}` : 'npm run db:pilot -- status',
  });
}

main().catch((err) => {
  log('error', err.message ?? String(err));
  process.exit(1);
});
