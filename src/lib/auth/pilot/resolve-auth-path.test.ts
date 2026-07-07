/**
 * RetailX V2 Milestone D1.4 — Auth path resolution tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  resolveAuthPathSync,
  resolveAuthPath,
  getEmergencyForceV1,
} from './resolve-auth-path';
import { DEFAULT_AUTH_CONFIG } from '../auth-config';

describe('resolveAuthPath', () => {
  const originalEnv = process.env.RETAILX_EMERGENCY_FORCE_V1;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.RETAILX_EMERGENCY_FORCE_V1;
    } else {
      process.env.RETAILX_EMERGENCY_FORCE_V1 = originalEnv;
    }
  });

  beforeEach(() => {
    delete process.env.RETAILX_EMERGENCY_FORCE_V1;
  });

  it('uses legacy when no pilot and global off', () => {
    const path = resolveAuthPathSync('shop-1', DEFAULT_AUTH_CONFIG, false);
    expect(path.source).toBe('legacy');
    expect(path.useMembershipAuth).toBe(false);
  });

  it('uses pilot when shop is pilot-enabled', () => {
    const path = resolveAuthPathSync('shop-pilot', DEFAULT_AUTH_CONFIG, true);
    expect(path.source).toBe('pilot');
    expect(path.useMembershipAuth).toBe(true);
    expect(path.pilotEnabled).toBe(true);
  });

  it('uses global flag when set and not pilot', () => {
    const path = resolveAuthPathSync(
      'shop-2',
      { ...DEFAULT_AUTH_CONFIG, useMembershipAuth: true },
      false
    );
    expect(path.source).toBe('global');
    expect(path.useMembershipAuth).toBe(true);
  });

  it('emergency override forces V1 for pilot shop', () => {
    process.env.RETAILX_EMERGENCY_FORCE_V1 = 'true';
    expect(getEmergencyForceV1()).toBe(true);

    const path = resolveAuthPathSync('shop-pilot', DEFAULT_AUTH_CONFIG, true);
    expect(path.source).toBe('emergency');
    expect(path.useMembershipAuth).toBe(false);
    expect(path.emergencyForceV1).toBe(true);
  });

  it('pilot takes precedence over global when both could apply', () => {
    const path = resolveAuthPathSync(
      'shop-pilot',
      { ...DEFAULT_AUTH_CONFIG, useMembershipAuth: false },
      true
    );
    expect(path.source).toBe('pilot');
    expect(path.useMembershipAuth).toBe(true);
  });

  it('async resolveAuthPath delegates to pilot check', async () => {
    const path = await resolveAuthPath('shop-x', DEFAULT_AUTH_CONFIG, async (id) => id === 'shop-x');
    expect(path.source).toBe('pilot');
  });

  it('non-pilot shop ignores global off', async () => {
    const path = await resolveAuthPath('shop-other', DEFAULT_AUTH_CONFIG, async () => false);
    expect(path.source).toBe('legacy');
  });
});
