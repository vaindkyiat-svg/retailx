/**
 * RetailX V2 Milestone C3 — Rollback validation (readiness only, no execution)
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { listMigrationFiles, getProjectRoot } from '../../lib/helpers.mjs';

export function validateRollbackReadiness() {
  const migrations = listMigrationFiles();
  const rollbackDir = join(getProjectRoot(), 'supabase', 'migrations', 'rollback');
  const rollbacks = readdirSync(rollbackDir).filter((f) => f.endsWith('.sql'));

  const checks = [];
  let ready = true;

  for (const mig of migrations) {
    const match = rollbacks.find((r) => r.startsWith(mig.version));
    if (!match) {
      checks.push({ migration: mig.filename, status: 'missing', ready: false });
      ready = false;
      continue;
    }

    const content = readFileSync(join(rollbackDir, match), 'utf8');
    const nonEmpty = content.trim().length > 0;
    const hasDestructive = /\bDROP\s+TABLE\s+public\.(shops|user_profiles|products|orders)\b/i.test(content);

    checks.push({
      migration: mig.filename,
      rollback: match,
      status: nonEmpty ? 'present' : 'empty',
      ready: nonEmpty && !hasDestructive,
      v1Safe: !hasDestructive,
    });

    if (!nonEmpty || hasDestructive) ready = false;
  }

  const rollbackOrder = [...migrations].reverse().map((m) => m.version);

  return {
    ready,
    score: Math.round((checks.filter((c) => c.ready).length / checks.length) * 100),
    totalMigrations: migrations.length,
    rollbackFiles: rollbacks.length,
    checks,
    recommendedRollbackOrder: rollbackOrder,
    note: 'Simulation only — rollbacks not executed on staging data',
  };
}

export async function validateBackfillRollbackScripts() {
  const scripts = [
    'scripts/infrastructure/rollback-backfill.mjs',
    'scripts/infrastructure/rollback.mjs',
  ];
  const root = getProjectRoot();
  return scripts.map((s) => ({
    script: s,
    exists: existsSync(join(root, s)),
    ready: existsSync(join(root, s)),
  }));
}
