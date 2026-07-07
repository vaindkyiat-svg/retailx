/**
 * RetailX V2 — Feature flag keys (compile-time registry)
 * Runtime values are loaded from platform_settings / feature_flags table or env overrides.
 */

export const FEATURE_FLAGS = {
  USE_V2_PROVISIONING: 'USE_V2_PROVISIONING',
  USE_MEMBERSHIP_AUTH: 'USE_MEMBERSHIP_AUTH',
  USE_MEMBERSHIP_RLS: 'USE_MEMBERSHIP_RLS',
  WRITE_LEGACY_CREDENTIALS: 'WRITE_LEGACY_CREDENTIALS',
  USE_V2_CHECKOUT: 'USE_V2_CHECKOUT',
  ENABLE_EDGE_FUNCTIONS: 'ENABLE_EDGE_FUNCTIONS',
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export type RetailXEnvironment = 'development' | 'staging' | 'production';

export interface FeatureFlagRecord {
  key: FeatureFlagKey;
  enabled: boolean;
  description?: string;
  environments?: Partial<Record<RetailXEnvironment, boolean>>;
}

const ENV_OVERRIDE_PREFIX = 'RETAILX_FLAG_';

/**
 * Read a feature flag from environment variable override.
 * Example: RETAILX_FLAG_USE_V2_PROVISIONING=true
 */
export function getEnvFlagOverride(key: FeatureFlagKey): boolean | undefined {
  const envKey = `${ENV_OVERRIDE_PREFIX}${key}`;
  const value = typeof import.meta !== 'undefined' && import.meta.env
    ? import.meta.env[envKey]
    : undefined;

  const processValue =
    typeof process !== 'undefined' ? process.env[envKey] : undefined;

  const raw = value ?? processValue;
  if (raw === undefined || raw === '') return undefined;
  return raw === 'true' || raw === '1';
}

/**
 * Resolve flag value: env override > DB record > default
 */
export function resolveFlag(
  key: FeatureFlagKey,
  record: FeatureFlagRecord | undefined,
  environment: RetailXEnvironment,
  defaultValue = false
): boolean {
  const envOverride = getEnvFlagOverride(key);
  if (envOverride !== undefined) return envOverride;

  if (record) {
    const envSpecific = record.environments?.[environment];
    if (envSpecific !== undefined) return envSpecific;
    return record.enabled;
  }

  return defaultValue;
}

/**
 * Default flag definitions for offline / bootstrap scenarios.
 * Matches supabase/seed/06_feature_flags.sql
 */
export const DEFAULT_FLAGS: FeatureFlagRecord[] = [
  {
    key: FEATURE_FLAGS.USE_V2_PROVISIONING,
    enabled: false,
    environments: { development: false, staging: false, production: false },
  },
  {
    key: FEATURE_FLAGS.USE_MEMBERSHIP_AUTH,
    enabled: false,
    environments: { development: false, staging: false, production: false },
  },
  {
    key: FEATURE_FLAGS.USE_MEMBERSHIP_RLS,
    enabled: false,
    environments: { development: false, staging: false, production: false },
  },
  {
    key: FEATURE_FLAGS.WRITE_LEGACY_CREDENTIALS,
    enabled: true,
    environments: { development: true, staging: true, production: true },
  },
  {
    key: FEATURE_FLAGS.USE_V2_CHECKOUT,
    enabled: false,
    environments: { development: false, staging: false, production: false },
  },
  {
    key: FEATURE_FLAGS.ENABLE_EDGE_FUNCTIONS,
    enabled: false,
    environments: { development: false, staging: false, production: false },
  },
];

export function buildFlagMap(
  records: FeatureFlagRecord[],
  environment: RetailXEnvironment
): Record<FeatureFlagKey, boolean> {
  const map = {} as Record<FeatureFlagKey, boolean>;
  const byKey = new Map(records.map((r) => [r.key, r]));

  for (const def of DEFAULT_FLAGS) {
    map[def.key] = resolveFlag(def.key, byKey.get(def.key), environment, def.enabled);
  }

  return map;
}
