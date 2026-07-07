#!/usr/bin/env node
/**
 * RetailX V2 — Validate migration files without applying
 */

import { readFileSync } from 'node:fs';
import {
  listMigrationFiles,
  validateMigrationFiles,
  log,
  MigrationError,
} from './lib/helpers.mjs';

async function main() {
  const files = listMigrationFiles();

  if (files.length === 0) {
    throw new MigrationError('No migration files found in supabase/migrations/', 'NO_MIGRATIONS');
  }

  validateMigrationFiles(files);

  let warnings = 0;

  for (const file of files) {
    const content = readFileSync(file.path, 'utf8');

    if (!content.includes('-- Migration:')) {
      log('warn', `Missing migration header comment: ${file.filename}`);
      warnings++;
    }

    if (content.includes('DROP TABLE') && !content.includes('IF EXISTS')) {
      log('warn', `Destructive DROP without IF EXISTS: ${file.filename}`);
      warnings++;
    }
  }

  log('info', 'Migration validation passed', {
    files: files.length,
    warnings,
  });

  for (const file of files) {
    console.log(`  ✓ ${file.filename} (${file.checksum})`);
  }
}

main().catch((err) => {
  if (err instanceof MigrationError) {
    log('error', err.message, { code: err.code });
  } else {
    log('error', err.message ?? String(err));
  }
  process.exit(1);
});
