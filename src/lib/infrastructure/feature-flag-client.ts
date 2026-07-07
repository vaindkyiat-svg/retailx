/**
 * RetailX V2 — Feature flag client (read-only, no business logic)
 * Loads flags from Supabase feature_flags table with env override support.
 */

import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import {
  type FeatureFlagKey,
  type FeatureFlagRecord,
  type RetailXEnvironment,
  FEATURE_FLAGS,
  buildFlagMap,
  resolveFlag,
  DEFAULT_FLAGS,
  getEnvFlagOverride,
} from './feature-flags';

export { FEATURE_FLAGS, getEnvFlagOverride, resolveFlag };

type FeatureFlagCacheAuth = 'anonymous' | 'authenticated';

let cachedFlags: Record<FeatureFlagKey, boolean> | null = null;
let cacheExpiry = 0;
let cachedAuthTier: FeatureFlagCacheAuth | null = null;
const CACHE_TTL_MS = 60_000;

let authSyncUnsubscribe: (() => void) | null = null;

function getEnvironment(): RetailXEnvironment {
  const env =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_RETAILX_ENV) ||
    (typeof process !== 'undefined' && process.env.RETAILX_ENV) ||
    'development';
  return env as RetailXEnvironment;
}

function rowToRecord(row: {
  key: string;
  enabled: boolean;
  description?: string | null;
  environments?: Record<string, boolean> | null;
}): FeatureFlagRecord {
  return {
    key: row.key as FeatureFlagKey,
    enabled: row.enabled,
    description: row.description ?? undefined,
    environments: (row.environments ?? undefined) as FeatureFlagRecord['environments'],
  };
}

async function resolveAuthTier(client: SupabaseClient = supabase): Promise<FeatureFlagCacheAuth> {
  try {
    const { data } = await client.auth.getSession();
    return data.session ? 'authenticated' : 'anonymous';
  } catch {
    return 'anonymous';
  }
}

function isCacheValidForAuthTier(now: number, authTier: FeatureFlagCacheAuth): boolean {
  if (!cachedFlags || now >= cacheExpiry) {
    return false;
  }

  // Never serve anonymous cache to an authenticated session.
  if (authTier === 'authenticated' && cachedAuthTier === 'anonymous') {
    return false;
  }

  return true;
}

async function loadFeatureFlagsFromDb(
  client: SupabaseClient = supabase
): Promise<Record<FeatureFlagKey, boolean>> {
  const environment = getEnvironment();
  const now = Date.now();
  const authTier = await resolveAuthTier(client);

  try {
    const { data, error } = await client.from('feature_flags').select('key, enabled, description, environments');

    if (error || !data) {
      cachedFlags = buildFlagMap(DEFAULT_FLAGS, environment);
      cachedAuthTier = authTier;
      cacheExpiry = now + CACHE_TTL_MS;
      return cachedFlags;
    }

    const records = data.map(rowToRecord);
    cachedFlags = buildFlagMap(records, environment);
    cachedAuthTier = authTier;
    cacheExpiry = now + CACHE_TTL_MS;
    return cachedFlags;
  } catch {
    cachedFlags = buildFlagMap(DEFAULT_FLAGS, environment);
    cachedAuthTier = authTier;
    cacheExpiry = now + CACHE_TTL_MS;
    return cachedFlags;
  }
}

/**
 * Fetch all feature flags from database.
 * Falls back to DEFAULT_FLAGS if table is unavailable (pre-migration).
 */
export async function fetchFeatureFlags(): Promise<Record<FeatureFlagKey, boolean>> {
  const now = Date.now();
  const authTier = await resolveAuthTier();

  if (isCacheValidForAuthTier(now, authTier)) {
    return cachedFlags!;
  }

  return loadFeatureFlagsFromDb();
}

/**
 * Check a single feature flag (async).
 */
export async function isFeatureEnabled(key: FeatureFlagKey): Promise<boolean> {
  const flags = await fetchFeatureFlags();
  return flags[key] ?? false;
}

/**
 * Synchronous check using env override or defaults only (no DB).
 * Use when async fetch is not possible.
 */
export function isFeatureEnabledSync(key: FeatureFlagKey): boolean {
  const envOverride = getEnvFlagOverride(key);
  if (envOverride !== undefined) return envOverride;

  const def = DEFAULT_FLAGS.find((f) => f.key === key);
  const environment = getEnvironment();
  return resolveFlag(key, def, environment, false);
}

/** Clear in-memory cache (e.g. after admin toggle or auth change) */
export function clearFeatureFlagCache(): void {
  cachedFlags = null;
  cacheExpiry = 0;
  cachedAuthTier = null;
}

async function refetchFeatureFlagsAfterAuthChange(client: SupabaseClient = supabase): Promise<void> {
  clearFeatureFlagCache();
  await loadFeatureFlagsFromDb(client);
}

function handleAuthStateChange(
  event: AuthChangeEvent,
  session: Session | null,
  client: SupabaseClient
): void {
  if (event === 'SIGNED_OUT') {
    clearFeatureFlagCache();
    return;
  }

  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    void refetchFeatureFlagsAfterAuthChange(client);
    return;
  }

  if (event === 'INITIAL_SESSION' && session && cachedAuthTier === 'anonymous') {
    void refetchFeatureFlagsAfterAuthChange(client);
  }
}

/**
 * Invalidate and reload feature flags when Supabase auth state changes.
 * Idempotent — safe to call once at application startup.
 */
export function installFeatureFlagAuthSync(client: SupabaseClient = supabase): () => void {
  if (authSyncUnsubscribe) {
    authSyncUnsubscribe();
    authSyncUnsubscribe = null;
  }

  const { data } = client.auth.onAuthStateChange((event, session) => {
    handleAuthStateChange(event, session, client);
  });

  authSyncUnsubscribe = () => {
    data.subscription.unsubscribe();
  };

  return authSyncUnsubscribe;
}

/** Test-only helpers */
export function getFeatureFlagCacheStateForTests(): {
  cachedFlags: Record<FeatureFlagKey, boolean> | null;
  cacheExpiry: number;
  cachedAuthTier: FeatureFlagCacheAuth | null;
} {
  return { cachedFlags, cacheExpiry, cachedAuthTier };
}

export function resetFeatureFlagClientForTests(): void {
  clearFeatureFlagCache();
  if (authSyncUnsubscribe) {
    authSyncUnsubscribe();
    authSyncUnsubscribe = null;
  }
}

installFeatureFlagAuthSync(supabase);
