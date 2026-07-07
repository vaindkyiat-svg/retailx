#!/usr/bin/env node
/**
 * RetailX V2 — Show migration status and history
 */

import {
  resolveEnvironment,
  listMigrationFiles,
  validateMigrationFiles,
  getAppliedMigrations,
  createClient,
  log,
} from './lib/helpers.mjs';

const args = process.argv.slice(2);
const envFlag = args.find((a) => a.startsWith('--env='))?.split('=')[1]
  ?? args[args.indexOf('--env') + 1];

async function main() {
  const env = resolveEnvironment(envFlag);
  const files = listMigrationFiles();
  validateMigrationFiles(files);

  const client = await createClient(env);

  try {
    const applied = await getAppliedMigrations(client, env);
    const appliedMap = new Map(applied.map((m) => [m.version, m]));

    console.log(`\nMigration Status — ${env}\n`);
    console.log('Version          Name                              Status     Checksum');
    console.log('─'.repeat(80));

    for (const file of files) {
      const record = appliedMap.get(file.version);
      const status = record ? 'applied' : 'pending';
      const checksum = record?.checksum ?? file.checksum;
      const match = record && record.checksum !== file.checksum ? ' ⚠ DRIFT' : '';
      console.log(
        `${file.version}  ${file.name.padEnd(32)}  ${status.padEnd(10)} ${checksum}${match}`
      );
    }

    const pending = files.filter((f) => !appliedMap.has(f.version));
    console.log(`\nTotal: ${files.length} | Applied: ${applied.length} | Pending: ${pending.length}\n`);

    if (pending.length > 0) {
      log('info', 'Run: npm run db:migrate');
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  log('error', err.message ?? String(err));
  process.exit(1);
});
