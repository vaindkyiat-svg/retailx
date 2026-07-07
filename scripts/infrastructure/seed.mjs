#!/usr/bin/env node
/**
 * RetailX V2 — Run idempotent seeds
 *
 * Usage:
 *   node scripts/infrastructure/seed.mjs [--env development]
 */

import { readFileSync } from 'node:fs';
import {
  resolveEnvironment,
  listSeedFiles,
  createClient,
  withTransaction,
  log,
  confirmProduction,
  loadEnvironments,
  loadEnvLocal,
} from './lib/helpers.mjs';

loadEnvLocal();

const args = process.argv.slice(2);
const envFlag = args.find((a) => a.startsWith('--env='))?.split('=')[1]
  ?? args[args.indexOf('--env') + 1];

async function main() {
  const env = resolveEnvironment(envFlag);
  const config = loadEnvironments()[env];

  if (config.requireConfirmation) {
    confirmProduction(`About to seed database on ${env}.`);
  }

  const seedFiles = listSeedFiles();
  if (seedFiles.length === 0) {
    log('warn', 'No seed files found');
    return;
  }

  const client = await createClient(env);

  try {
    await withTransaction(client, async (tx) => {
      for (const file of seedFiles) {
        const sql = readFileSync(file, 'utf8');
        const start = Date.now();
        await tx.query(sql);
        log('info', `Seeded ${file.split(/[/\\]/).pop()}`, { ms: Date.now() - start });
      }
    });

    log('info', 'Seed complete', { files: seedFiles.length, environment: env });
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  log('error', err.message ?? String(err));
  process.exit(1);
});
