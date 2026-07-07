/**
 * RetailX V2 Milestone D1.1 — Auth architecture validation tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { getProjectRoot } from '../../../scripts/infrastructure/lib/helpers.mjs';

describe('D1.1 auth module structure', () => {
  const root = getProjectRoot();
  const authDir = join(root, 'src/lib/auth');

  const requiredFiles = [
    'AuthProvider.tsx',
    'AuthContext.tsx',
    'types.ts',
    'session.ts',
    'session-store.ts',
    'auth-config.ts',
    'resolve-membership.ts',
    'resolve-tenant.ts',
    'errors.ts',
    'auth-logger.ts',
    'index.ts',
  ];

  for (const file of requiredFiles) {
    it(`exists: ${file}`, () => {
      assert.ok(existsSync(join(authDir, file)), `Missing ${file}`);
    });
  }

  it('main.tsx wraps App with AuthProvider', () => {
    const main = readFileSync(join(root, 'src/main.tsx'), 'utf8');
    assert.ok(main.includes('AuthProvider'));
    assert.ok(main.includes('<App />'));
  });

  it('public API does not export internal session-store directly as primary', () => {
    const index = readFileSync(join(authDir, 'index.ts'), 'utf8');
    assert.ok(index.includes('export { AuthProvider }'));
    assert.ok(index.includes('resolveTenant'));
  });
});

describe('D1.1 auth architecture validation script', () => {
  it('passes validate-auth-architecture.mjs', () => {
    const root = getProjectRoot();
    const result = spawnSync(process.execPath, ['scripts/infrastructure/validate-auth-architecture.mjs'], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });
});

describe('D1.3 shadow identity validation', () => {
  const root = getProjectRoot();
  const shadowDir = join(root, 'src/lib/auth/shadow');

  const shadowFiles = [
    'ShadowIdentityValidator.ts',
    'IdentityComparison.ts',
    'ComparisonResult.ts',
    'ShadowReport.ts',
    'shadow-metrics.ts',
    'identity-validation-log.ts',
  ];

  for (const file of shadowFiles) {
    it(`exists: shadow/${file}`, () => {
      assert.ok(existsSync(join(shadowDir, file)), `Missing shadow/${file}`);
    });
  }

  it('AuthService schedules shadow validation without await', () => {
    const authService = readFileSync(join(root, 'src/lib/auth/services/AuthService.ts'), 'utf8');
    assert.ok(authService.includes('scheduleShadowValidation'));
    assert.ok(!/await\s+this\.shadowValidator\.validate/.test(authService));
  });

  it('identity validation migration exists', () => {
    assert.ok(
      existsSync(join(root, 'supabase/migrations/20260707150000_identity_validation.sql')),
      'Missing identity_validation migration'
    );
  });

  it('public API exports shadow dashboard', () => {
    const index = readFileSync(join(root, 'src/lib/auth/index.ts'), 'utf8');
    assert.ok(index.includes('getShadowDashboardReport'));
    assert.ok(index.includes('ShadowIdentityValidator'));
  });
});

describe('D1.4 internal shop pilot', () => {
  const root = getProjectRoot();
  const pilotDir = join(root, 'src/lib/auth/pilot');

  const pilotFiles = [
    'resolve-auth-path.ts',
    'pilot-shop-client.ts',
    'pilot-metrics.ts',
    'PilotReport.ts',
    'types.ts',
  ];

  for (const file of pilotFiles) {
    it(`exists: pilot/${file}`, () => {
      assert.ok(existsSync(join(pilotDir, file)), `Missing pilot/${file}`);
    });
  }

  it('pilot_shops migration exists with single-active constraint', () => {
    const sql = readFileSync(
      join(root, 'supabase/migrations/20260708120000_pilot_shops.sql'),
      'utf8'
    );
    assert.ok(sql.includes('pilot_shops'));
    assert.ok(sql.includes('idx_pilot_shops_single_active'));
  });

  it('rollback CLI script exists', () => {
    assert.ok(existsSync(join(root, 'scripts/infrastructure/pilot-shop.mjs')));
  });

  it('AuthService uses resolveAuthPath for shop-scoped routing', () => {
    const authService = readFileSync(join(root, 'src/lib/auth/services/AuthService.ts'), 'utf8');
    assert.ok(authService.includes('resolveAuthPath'));
    assert.ok(authService.includes('scheduleShadowValidation'));
  });

  it('public API exports pilot dashboard', () => {
    const index = readFileSync(join(root, 'src/lib/auth/index.ts'), 'utf8');
    assert.ok(index.includes('getPilotDashboardReport'));
    assert.ok(index.includes('clearPilotShopCache'));
  });
});

describe('D1.4A rollout controller', () => {
  const root = getProjectRoot();
  const releaseDir = join(root, 'src/lib/auth/release');

  const releaseFiles = [
    'RolloutController.ts',
    'ReleaseDecision.ts',
    'ReleaseGate.ts',
    'ReleaseMetrics.ts',
    'ReleaseReport.ts',
    'release-gate-engine.ts',
    'auth-incident-engine.ts',
    'release-history.ts',
  ];

  for (const file of releaseFiles) {
    it(`exists: release/${file}`, () => {
      assert.ok(existsSync(join(releaseDir, file)), `Missing release/${file}`);
    });
  }

  it('AuthService does not integrate rollout controller', () => {
    const authService = readFileSync(join(root, 'src/lib/auth/services/AuthService.ts'), 'utf8');
    assert.ok(!authService.includes('RolloutController'));
    assert.ok(!authService.includes('rolloutController'));
  });

  it('release_history migration exists', () => {
    assert.ok(
      existsSync(join(root, 'supabase/migrations/20260708130000_release_history.sql'))
    );
  });

  it('public API exports release evaluation', () => {
    const index = readFileSync(join(root, 'src/lib/auth/index.ts'), 'utf8');
    assert.ok(index.includes('evaluateReleaseRollout'));
    assert.ok(index.includes('getReleaseDashboardReport'));
    assert.ok(index.includes('rolloutController'));
  });
});

describe('D1.1 no auth internals imported outside module', () => {
  it('App.tsx imports auth from public API only', () => {
    const root = getProjectRoot();
    const app = readFileSync(join(root, 'src/app/App.tsx'), 'utf8');
    assert.ok(app.includes('../lib/auth'));
    assert.ok(!app.includes('/auth/repositories'));
    assert.ok(app.includes('getAuthUser'));
    assert.ok(!app.includes('signInWithPassword'));
  });

  it('database.ts has no auth operations', () => {
    const root = getProjectRoot();
    const db = readFileSync(join(root, 'src/lib/database.ts'), 'utf8');
    assert.ok(!db.includes('signInWithPassword'));
    assert.ok(!db.includes('export async function signIn'));
    assert.ok(!db.includes('export async function getAuthUser'));
  });
});
