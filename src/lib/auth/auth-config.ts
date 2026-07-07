/**
 * RetailX V2 Milestone D1.1 — Auth feature flag configuration (read-only)
 * All flags default OFF — V1 behavior preserved.
 */

import {
  FEATURE_FLAGS,
  isFeatureEnabledSync,
  fetchFeatureFlags,
} from '../infrastructure/feature-flag-client';
import type { AuthConfig } from './types';

export const DEFAULT_AUTH_CONFIG: AuthConfig = {
  useMembershipAuth: false,
  useMembershipRls: false,
  useV2Provisioning: false,
};

/** Synchronous config from env overrides and defaults only (no DB round-trip). */
export function getAuthConfigSync(): AuthConfig {
  return {
    useMembershipAuth: isFeatureEnabledSync(FEATURE_FLAGS.USE_MEMBERSHIP_AUTH),
    useMembershipRls: isFeatureEnabledSync(FEATURE_FLAGS.USE_MEMBERSHIP_RLS),
    useV2Provisioning: isFeatureEnabledSync(FEATURE_FLAGS.USE_V2_PROVISIONING),
  };
}

/** Async config including database feature_flags table. */
export async function getAuthConfig(): Promise<AuthConfig> {
  const flags = await fetchFeatureFlags();
  return {
    useMembershipAuth: flags[FEATURE_FLAGS.USE_MEMBERSHIP_AUTH] ?? false,
    useMembershipRls: flags[FEATURE_FLAGS.USE_MEMBERSHIP_RLS] ?? false,
    useV2Provisioning: flags[FEATURE_FLAGS.USE_V2_PROVISIONING] ?? false,
  };
}

export function resolveAuthMode(config: AuthConfig): 'legacy' | 'membership' {
  return config.useMembershipAuth ? 'membership' : 'legacy';
}
