#!/usr/bin/env node

/**

 * RetailX V2 Milestone D1.2 — Auth module architecture validation

 */



import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';

import { join, relative } from 'node:path';

import { fileURLToPath } from 'node:url';



const __dirname = fileURLToPath(new URL('.', import.meta.url));

const root = join(__dirname, '..', '..');

const authDir = join(root, 'src', 'lib', 'auth');

const srcDir = join(root, 'src');



const FORBIDDEN_IN_AUTH = [

  /\bservice_role\b/i,

  /\bSERVICE_ROLE\b/,

  /\bcreateServiceSupabase\b/,

  /\.query\s*\(/,

  /\bSELECT\b.+\bFROM\b/i,

  /\bINSERT\b.+\bINTO\b/i,

];



/** Files allowed to import from @/lib/auth or ../lib/auth (public API only) */

const ALLOWED_AUTH_IMPORTERS = new Set([

  'src/main.tsx',

  'src/app/App.tsx',

  'src/lib/auth/index.ts',

]);



const FORBIDDEN_DATABASE_AUTH = [

  /signInWithPassword/,

  /export async function signIn/,

  /export async function signOut/,

  /export async function getAuthUser/,

];



function collectFiles(dir, acc = []) {

  for (const entry of readdirSync(dir)) {

    const full = join(dir, entry);

    if (statSync(full).isDirectory()) {

      collectFiles(full, acc);

    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.(ts|tsx)$/.test(entry)) {

      acc.push(full);

    }

  }

  return acc;

}



function validateAuthModule() {

  const errors = [];

  for (const file of collectFiles(authDir)) {

    const content = readFileSync(file, 'utf8');

    const rel = relative(root, file).replace(/\\/g, '/');

    for (const pattern of FORBIDDEN_IN_AUTH) {

      if (pattern.test(content)) {

        errors.push(`${rel}: forbidden pattern ${pattern}`);

      }

    }

  }

  return errors;

}



function validateImportBoundaries() {

  const errors = [];



  function scan(dir) {

    for (const entry of readdirSync(dir)) {

      const full = join(dir, entry);

      if (statSync(full).isDirectory()) {

        if (entry === 'auth') continue;

        scan(full);

      } else if (/\.(ts|tsx)$/.test(entry)) {

        const content = readFileSync(full, 'utf8');

        const rel = relative(root, full).replace(/\\/g, '/');



        if (/from\s+['"].*\/auth\/repositories/.test(content)) {

          if (!rel.startsWith('src/lib/auth/')) {

            errors.push(`${rel}: must not import auth repositories directly`);

          }

        }



        if (/from\s+['"].*\/auth\/(?!index)/.test(content)) {

          if (!ALLOWED_AUTH_IMPORTERS.has(rel) && !rel.startsWith('src/lib/auth/')) {

            errors.push(`${rel}: must not import auth internals`);

          }

        }



        const usesPublicAuth =

          /from\s+['"]@\/lib\/auth['"]/.test(content) ||

          /from\s+['"].*\/lib\/auth['"]/.test(content);



        if (usesPublicAuth && !ALLOWED_AUTH_IMPORTERS.has(rel) && !rel.startsWith('src/lib/auth/')) {

          errors.push(`${rel}: unauthorized auth module import`);

        }

      }

    }

  }



  scan(srcDir);

  return errors;

}



function validateDatabaseHasNoAuth() {

  const errors = [];

  const databasePath = join(root, 'src/lib/database.ts');

  const content = readFileSync(databasePath, 'utf8');



  for (const pattern of FORBIDDEN_DATABASE_AUTH) {

    if (pattern.test(content)) {

      errors.push(`database.ts: auth logic must not remain (${pattern})`);

    }

  }



  return errors;

}



function validateNoServiceRoleInBrowser() {

  const errors = [];

  const databaseTs = readFileSync(join(root, 'src/lib/database.ts'), 'utf8');



  if (!databaseTs.includes("typeof window === 'undefined'")) {

    errors.push('database.ts: service client must be gated on typeof window');

  }



  for (const file of collectFiles(authDir)) {

    const content = readFileSync(file, 'utf8');

    if (content.includes('createServiceSupabase')) {

      errors.push(`${relative(root, file)}: must not use createServiceSupabase`);

    }

  }



  return errors;

}



function validateShadowMode() {

  const errors = [];

  const shadowDir = join(authDir, 'shadow');

  const authServicePath = join(authDir, 'services', 'AuthService.ts');

  const authServiceContent = readFileSync(authServicePath, 'utf8');



  if (!authServiceContent.includes('scheduleShadowValidation')) {

    errors.push('AuthService.ts: must schedule shadow validation on sign-in');

  }

  if (/await\s+this\.shadowValidator\.validate/.test(authServiceContent)) {

    errors.push('AuthService.ts: must not await shadow validation (blocks login)');

  }



  const forbiddenInShadow = [

    /sessionStore\./,

    /sessionManager\./,

    /\.signIn\s*\(/,

    /\.signOut\s*\(/,

    /\.insert\s*\(/,

    /\.update\s*\(/,

    /\.delete\s*\(/,

    /USE_MEMBERSHIP_AUTH\s*=\s*true/,

  ];



  if (statSync(shadowDir).isDirectory()) {

    for (const file of collectFiles(shadowDir)) {

      const content = readFileSync(file, 'utf8');

      const rel = relative(root, file).replace(/\\/g, '/');

      for (const pattern of forbiddenInShadow) {

        if (pattern.test(content)) {

          errors.push(`${rel}: shadow mode must not mutate session/DB (${pattern})`);

        }

      }

    }

  }



  const comparisonPath = join(shadowDir, 'IdentityComparison.ts');

  if (existsSync(comparisonPath)) {

    const comparison = readFileSync(comparisonPath, 'utf8');

    if (!comparison.includes('shadowDiscarded: true') || !comparison.includes('v1Authoritative: true')) {

      errors.push('IdentityComparison.ts: must mark V1 authoritative and discard shadow');

    }

  }



  return errors;

}



function validatePilotMode() {

  const errors = [];

  const authServicePath = join(authDir, 'services', 'AuthService.ts');

  const authServiceContent = readFileSync(authServicePath, 'utf8');

  const pilotDir = join(authDir, 'pilot');

  const pilotScript = join(root, 'scripts', 'infrastructure', 'pilot-shop.mjs');

  const seedFlags = readFileSync(join(root, 'supabase', 'seed', '06_feature_flags.sql'), 'utf8');



  if (!authServiceContent.includes('resolveAuthPath')) {

    errors.push('AuthService.ts: must use shop-scoped resolveAuthPath (D1.4 pilot)');

  }



  if (!existsSync(pilotScript)) {

    errors.push('scripts/infrastructure/pilot-shop.mjs: rollback CLI required');

  }



  if (/USE_MEMBERSHIP_AUTH[\s\S]*?enabled[\s\S]*?true/i.test(seedFlags)) {

    errors.push('seed/06_feature_flags.sql: USE_MEMBERSHIP_AUTH must default false (no global enable)');

  }



  const forbiddenInPilot = [

    /sessionStore\./,

    /sessionManager\./,

    /\.signIn\s*\(/,

    /\.signOut\s*\(/,

  ];



  if (statSync(pilotDir).isDirectory()) {

    for (const file of collectFiles(pilotDir)) {

      const content = readFileSync(file, 'utf8');

      const rel = relative(root, file).replace(/\\/g, '/');

      for (const pattern of forbiddenInPilot) {

        if (pattern.test(content)) {

          errors.push(`${rel}: pilot module must not mutate session (${pattern})`);

        }

      }

    }

  }



  const migrationPath = join(root, 'supabase', 'migrations', '20260708120000_pilot_shops.sql');

  if (!existsSync(migrationPath)) {

    errors.push('Missing pilot_shops migration (20260708120000_pilot_shops.sql)');

  } else {

    const migration = readFileSync(migrationPath, 'utf8');

    if (!migration.includes('idx_pilot_shops_single_active')) {

      errors.push('pilot_shops migration: must enforce single active pilot shop');

    }

  }



  return errors;

}



function validateReleaseController() {

  const errors = [];

  const releaseDir = join(authDir, 'release');

  const authServicePath = join(authDir, 'services', 'AuthService.ts');

  const authServiceContent = readFileSync(authServicePath, 'utf8');

  const rolloutPath = join(releaseDir, 'RolloutController.ts');



  if (!existsSync(rolloutPath)) {

    errors.push('Missing RolloutController.ts (D1.4A)');

    return errors;

  }



  const rolloutContent = readFileSync(rolloutPath, 'utf8');



  if (authServiceContent.includes('rolloutController') || authServiceContent.includes('RolloutController')) {

    errors.push('AuthService.ts: must not integrate rollout controller (no login changes)');

  }



  if (!rolloutContent.includes('resolveDecisionFromGates')) {

    errors.push('RolloutController.ts: must use gate engine (no bypass)');

  }



  if (!rolloutContent.includes('getEmergencyForceV1')) {

    errors.push('RolloutController.ts: must respect emergency override');

  }



  if (/threshold:\s*\d+/.test(rolloutContent)) {

    errors.push('RolloutController.ts: must not hardcode gate thresholds');

  }



  const forbiddenInRelease = [

    /\.signIn\s*\(/,

    /scheduleShadowValidation/,

    /USE_MEMBERSHIP_AUTH\s*=\s*true/,

    /pilot_shops.*enabled\s*=\s*true/i,

    /enablePilot/i,

  ];



  if (statSync(releaseDir).isDirectory()) {

    for (const file of collectFiles(releaseDir)) {

      const content = readFileSync(file, 'utf8');

      const rel = relative(root, file).replace(/\\/g, '/');

      for (const pattern of forbiddenInRelease) {

        if (pattern.test(content)) {

          errors.push(`${rel}: release module must not enable pilot or change auth (${pattern})`);

        }

      }

    }

  }



  const gateConfigPath = join(releaseDir, 'ReleaseGate.ts');

  if (existsSync(gateConfigPath)) {

    const gateConfig = readFileSync(gateConfigPath, 'utf8');

    if (!gateConfig.includes('DEFAULT_RELEASE_GATE_CONFIG')) {

      errors.push('ReleaseGate.ts: configurable gate defaults required');

    }

  }



  const migrationPath = join(root, 'supabase', 'migrations', '20260708130000_release_history.sql');

  if (!existsSync(migrationPath)) {

    errors.push('Missing release_history migration');

  }



  const releaseScript = join(root, 'scripts', 'infrastructure', 'release-evaluate.mjs');

  if (!existsSync(releaseScript)) {

    errors.push('Missing release-evaluate.mjs CLI');

  }



  return errors;

}



const allErrors = [

  ...validateAuthModule(),

  ...validateImportBoundaries(),

  ...validateDatabaseHasNoAuth(),

  ...validateNoServiceRoleInBrowser(),

  ...validateShadowMode(),

  ...validatePilotMode(),

  ...validateReleaseController(),

];



if (allErrors.length > 0) {

  console.error('Auth architecture validation FAILED:');

  allErrors.forEach((e) => console.error(`  ✗ ${e}`));

  process.exit(1);

}



console.log('Auth architecture validation PASSED');

console.log(`  ✓ ${collectFiles(authDir).length} auth module files scanned`);

console.log('  ✓ No auth logic in database.ts');

console.log('  ✓ No service_role in auth module');

console.log('  ✓ Import boundaries respected');

console.log('  ✓ Shadow mode cannot block login or mutate session');

console.log('  ✓ Pilot mode: single-shop only, global flag off, rollback CLI present');

console.log('  ✓ Release controller: advisory only, no login/pilot enable bypass');
