#!/usr/bin/env node
/**
 * RetailX V2 — Run all infrastructure tests
 */

import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testsDir = join(__dirname, '..', '..', 'supabase', 'tests');

function collectTests(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTests(full));
    } else if (entry.name.endsWith('.test.mjs')) {
      files.push(full);
    }
  }
  return files;
}

const testFiles = collectTests(testsDir);

if (testFiles.length === 0) {
  console.error('No test files found');
  process.exit(1);
}

const child = spawn(
  process.execPath,
  ['--test', ...testFiles],
  { stdio: 'inherit', env: process.env }
);

child.on('close', (code) => {
  process.exit(code ?? 1);
});
