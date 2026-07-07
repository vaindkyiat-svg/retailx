/**
 * RetailX V2 Milestone D1.1 — resolveTenant unit tests
 */

import { describe, it, expect } from 'vitest';
import { resolveTenant } from './resolve-tenant';
import type { MembershipContext } from '../types';

const membership: MembershipContext = {
  membershipId: 'm1',
  shopId: 'shop-v2',
  userId: 'user-1',
  roleSlug: 'shop_owner',
  isPrimary: true,
  status: 'active',
  source: 'membership',
};

const profile = {
  userId: 'user-1',
  shopId: 'shop-v1',
  role: 'shop_owner' as const,
};

describe('resolveTenant', () => {
  it('uses user_profile when flag off (V1 behavior)', () => {
    const result = resolveTenant({
      useMembershipAuth: false,
      profile,
      membership,
    });
    expect(result?.shopId).toBe('shop-v1');
    expect(result?.resolutionSource).toBe('user_profile');
  });

  it('uses membership when flag on and membership present', () => {
    const result = resolveTenant({
      useMembershipAuth: true,
      profile,
      membership,
    });
    expect(result?.shopId).toBe('shop-v2');
    expect(result?.resolutionSource).toBe('membership');
  });

  it('falls back to profile when flag on but no membership', () => {
    const result = resolveTenant({
      useMembershipAuth: true,
      profile,
      membership: null,
    });
    expect(result?.shopId).toBe('shop-v1');
    expect(result?.resolutionSource).toBe('user_profile');
  });

  it('returns null when no shop_id on profile and flag off', () => {
    const result = resolveTenant({
      useMembershipAuth: false,
      profile: { userId: 'user-1', role: 'admin' },
      membership: null,
    });
    expect(result).toBeNull();
  });

  it('maps platform_admin to admin role', () => {
    const adminMembership: MembershipContext = {
      ...membership,
      roleSlug: 'platform_admin',
    };
    const result = resolveTenant({
      useMembershipAuth: true,
      profile: null,
      membership: adminMembership,
    });
    expect(result?.role).toBe('admin');
  });
});
