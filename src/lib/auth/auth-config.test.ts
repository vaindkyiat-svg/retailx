/**
 * RetailX V2 Milestone D1.1 — auth-config unit tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_AUTH_CONFIG,
  getAuthConfigSync,
  resolveAuthMode,
} from './auth-config';

describe('auth-config', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.RETAILX_FLAG_USE_MEMBERSHIP_AUTH;
    delete process.env.RETAILX_FLAG_USE_MEMBERSHIP_RLS;
    delete process.env.RETAILX_FLAG_USE_V2_PROVISIONING;
  });

  afterEach(() => {
    process.env = envBackup;
  });

  it('DEFAULT_AUTH_CONFIG has all flags off', () => {
    expect(DEFAULT_AUTH_CONFIG.useMembershipAuth).toBe(false);
    expect(DEFAULT_AUTH_CONFIG.useMembershipRls).toBe(false);
    expect(DEFAULT_AUTH_CONFIG.useV2Provisioning).toBe(false);
  });

  it('getAuthConfigSync returns all flags off by default', () => {
    const config = getAuthConfigSync();
    expect(config).toEqual(DEFAULT_AUTH_CONFIG);
  });

  it('resolveAuthMode returns legacy when auth flag off', () => {
    expect(resolveAuthMode(DEFAULT_AUTH_CONFIG)).toBe('legacy');
  });

  it('resolveAuthMode returns membership when auth flag on', () => {
    expect(
      resolveAuthMode({ ...DEFAULT_AUTH_CONFIG, useMembershipAuth: true })
    ).toBe('membership');
  });

  it('respects env override for USE_MEMBERSHIP_AUTH', () => {
    process.env.RETAILX_FLAG_USE_MEMBERSHIP_AUTH = 'true';
    const config = getAuthConfigSync();
    expect(config.useMembershipAuth).toBe(true);
    expect(config.useMembershipRls).toBe(false);
  });
});
