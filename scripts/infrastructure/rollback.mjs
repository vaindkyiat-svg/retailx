#!/usr/bin/env node
/**
 * RetailX V2 — Roll back the last applied migration
 *
 * Usage:
 *   node scripts/infrastructure/rollback.mjs [--env development] [--steps 1]
 *
 * Rollback SQL files live in supabase/migrations/rollback/
 * Named: YYYYMMDDHHMMSS_name.sql (matching forward migration version)
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  resolveEnvironment,
  getAppliedMigrations,
  createClient,
  withTransaction,
  log,
  MigrationError,
  confirmProduction,
  loadEnvironments,
  getProjectRoot,
} from './lib/helpers.mjs';

const args = process.argv.slice(2);
const envFlag = args.find((a) => a.startsWith('--env='))?.split('=')[1]
  ?? args[args.indexOf('--env') + 1];
const steps = parseInt(
  args.find((a) => a.startsWith('--steps='))?.split('=')[1]
    ?? args[args.indexOf('--steps') + 1]
    ?? '1',
  10
);

function getRollbackDir() {
  return join(getProjectRoot(), 'supabase', 'migrations', 'rollback');
}

function findRollbackSql(version) {
  const dir = getRollbackDir();
  if (!existsSync(dir)) return null;

  const files = readdirSync(dir).filter((f) => f.startsWith(version) && f.endsWith('.sql'));
  if (files.length === 0) return null;

  return readFileSync(join(dir, files[0]), 'utf8');
}

async function main() {
  const env = resolveEnvironment(envFlag);
  const config = loadEnvironments()[env];

  if (env === 'production') {
    throw new MigrationError('Rollback is disabled in production via CLI', 'PRODUCTION_ROLLBACK_BLOCKED');
  }

  if (config.requireConfirmation) {
    confirmProduction(`About to rollback ${steps} migration(s) on ${env}.`);
  }

  const client = await createClient(env);

  try {
    const applied = await getAppliedMigrations(client, env);
    if (applied.length === 0) {
      log('info', 'No migrations to rollback');
      return;
    }

    const toRollback = applied.slice(-steps).reverse();

    for (const record of toRollback) {
      const rollbackSql = findRollbackSql(record.version);

      if (!rollbackSql) {
        throw new MigrationError(
          `No rollback file for version ${record.version}. ` +
            `Create supabase/migrations/rollback/${record.version}_${record.name}.sql`,
          'ROLLBACK_NOT_FOUND',
          { version: record.version }
        );
      }

      const start = Date.now();

      await withTransaction(client, async (tx) => {
        await tx.query(rollbackSql);

        await tx.query(
          `UPDATE public.migration_history
           SET status = 'rolled_back', rolled_back_at = now()
           WHERE version = $1 AND environment = $2 AND status = 'applied'`,
          [record.version, env]
        );
      });

      log('info', `Rolled back ${record.version}_${record.name}`, { ms: Date.now() - start });
    }

    log('info', 'Rollback complete', { count: toRollback.length, environment: env });
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  if (err instanceof MigrationError) {
    log('error', err.message, { code: err.code, ...err.details });
  } else {
    log('error', err.message ?? String(err));
  }
  process.exit(1);
});
