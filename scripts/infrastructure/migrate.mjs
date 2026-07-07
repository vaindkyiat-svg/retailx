#!/usr/bin/env node
/**
 * RetailX V2 — Apply pending database migrations
 *
 * Usage:
 *   node scripts/infrastructure/migrate.mjs [--env development|staging|production]
 *   RETAILX_ENV=staging node scripts/infrastructure/migrate.mjs
 */

import { readFileSync } from 'node:fs';
import {
  resolveEnvironment,
  listMigrationFiles,
  validateMigrationFiles,
  getAppliedMigrations,
  createClient,
  withTransaction,
  log,
  MigrationError,
  confirmProduction,
  loadEnvironments,
  loadEnvLocal,
} from './lib/helpers.mjs';

loadEnvLocal();

const args = process.argv.slice(2);
const envFlag = args.find((a) => a.startsWith('--env='))?.split('=')[1]
  ?? args[args.indexOf('--env') + 1];
const dryRun = args.includes('--dry-run');

async function main() {
  const env = resolveEnvironment(envFlag);
  const config = loadEnvironments()[env];

  if (config.requireConfirmation) {
    confirmProduction(`About to run migrations on ${env}.`);
  }

  const files = listMigrationFiles();
  validateMigrationFiles(files);

  if (files.length === 0) {
    log('info', 'No migration files found');
    return;
  }

  const client = await createClient(env);

  try {
    const applied = await getAppliedMigrations(client, env);
    const appliedVersions = new Set(applied.map((m) => m.version));

    const pending = files.filter((f) => !appliedVersions.has(f.version));

    if (pending.length === 0) {
      log('info', 'All migrations already applied', { environment: env, count: files.length });
      return;
    }

    log('info', `Applying ${pending.length} migration(s)`, { environment: env });

    for (const migration of pending) {
      const sql = readFileSync(migration.path, 'utf8');
      const start = Date.now();

      if (dryRun) {
        log('info', `[dry-run] Would apply ${migration.filename}`, { checksum: migration.checksum });
        continue;
      }

      await withTransaction(client, async (tx) => {
        await tx.query(sql);

        await tx.query(
          `INSERT INTO public.migration_history
             (version, name, checksum, status, environment, applied_by, execution_ms)
           VALUES ($1, $2, $3, 'applied', $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [
            migration.version,
            migration.name,
            migration.checksum,
            env,
            process.env.USER ?? 'migration-runner',
            Date.now() - start,
          ]
        );
      });

      log('info', `Applied ${migration.filename}`, {
        version: migration.version,
        ms: Date.now() - start,
      });
    }

    log('info', 'Migration complete', { applied: pending.length, environment: env });
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
