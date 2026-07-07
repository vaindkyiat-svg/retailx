/**
 * RetailX V2 Milestone D1.4 — Auth path resolution (shop-scoped pilot)
 *
 * Decision order:
 *   1. Emergency override (force V1)
 *   2. Pilot shop (per-shop membership auth)
 *   3. Global USE_MEMBERSHIP_AUTH flag
 *   4. Legacy V1
 */

import type { AuthConfig } from '../types';
import type { AuthPathResolution } from './types';

const EMERGENCY_FORCE_V1_KEY = 'RETAILX_EMERGENCY_FORCE_V1';

function readEnv(key: string): string | undefined {
  const viteVal =
    typeof import.meta !== 'undefined' && import.meta.env
      ? (import.meta.env[key] as string | undefined)
      : undefined;
  const processVal = typeof process !== 'undefined' ? process.env[key] : undefined;
  const raw = viteVal ?? processVal;
  return raw === undefined || raw === '' ? undefined : raw;
}

/** Emergency kill-switch — forces all shops to V1 immediately (no deploy). */
export function getEmergencyForceV1(): boolean {
  const raw = readEnv(EMERGENCY_FORCE_V1_KEY);
  return raw === 'true' || raw === '1';
}

export function resolveAuthPathSync(
  shopId: string | undefined,
  globalConfig: AuthConfig,
  pilotEnabledForShop: boolean
): AuthPathResolution {
  if (getEmergencyForceV1()) {
    return {
      useMembershipAuth: false,
      source: 'emergency',
      shopId,
      emergencyForceV1: true,
    };
  }

  if (shopId && pilotEnabledForShop) {
    return {
      useMembershipAuth: true,
      source: 'pilot',
      shopId,
      pilotEnabled: true,
    };
  }

  if (globalConfig.useMembershipAuth) {
    return {
      useMembershipAuth: true,
      source: 'global',
      shopId,
    };
  }

  return {
    useMembershipAuth: false,
    source: 'legacy',
    shopId,
  };
}

export async function resolveAuthPath(
  shopId: string | undefined,
  globalConfig: AuthConfig,
  isPilotShopEnabled: (shopId: string) => Promise<boolean>
): Promise<AuthPathResolution> {
  if (getEmergencyForceV1()) {
    return resolveAuthPathSync(shopId, globalConfig, false);
  }

  const pilotEnabled = shopId ? await isPilotShopEnabled(shopId) : false;
  return resolveAuthPathSync(shopId, globalConfig, pilotEnabled);
}
