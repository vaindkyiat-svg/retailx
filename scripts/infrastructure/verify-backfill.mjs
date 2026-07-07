#!/usr/bin/env node
/**
 * RetailX V2 — Backfill verification (delegates to C2 health engine)
 * @deprecated Use npm run db:health instead
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const healthScript = join(__dirname, 'health.mjs');

const child = spawn(process.execPath, [healthScript, '--quick', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});

child.on('close', (code) => process.exit(code ?? 1));
