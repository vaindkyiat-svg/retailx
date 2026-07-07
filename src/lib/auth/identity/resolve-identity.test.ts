/**
 * RetailX V2 Milestone D1.2 — Identity resolution tests
 */

import { describe, it, expect } from 'vitest';
import { buildIdentityContext } from './resolve-identity';

describe('buildIdentityContext', () => {
  const base = {
    userId: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    profile: {
      userId: 'user-1',
      shopId: 'shop-v1',
      role: 'shop_owner' as const,
    },
    memberships: [
      {
        id: 'm1',
        shopId: 'shop-v2',
        userId: 'user-1',
        roleSlug: 'shop_owner',
        isPrimary: true,
        status: 'active' as const,
      },
    ],
  };

  it('resolves V1 identity when flag off', () => {
    const ctx = buildIdentityContext({ ...base, useMembershipAuth: false });
    expect(ctx?.resolutionMode).toBe('v1');
    expect(ctx?.user.shop_id).toBe('shop-v1');
    expect(ctx?.membership).toBeNull();
    expect(ctx?.tenant?.resolutionSource).toBe('user_profile');
  });

  it('resolves V2 identity when flag on', () => {
    const ctx = buildIdentityContext({ ...base, useMembershipAuth: true });
    expect(ctx?.resolutionMode).toBe('v2');
    expect(ctx?.user.shop_id).toBe('shop-v2');
    expect(ctx?.membership?.membershipId).toBe('m1');
    expect(ctx?.tenant?.resolutionSource).toBe('membership');
  });

  it('falls back to V1 profile when flag on but no membership', () => {
    const ctx = buildIdentityContext({
      ...base,
      useMembershipAuth: true,
      memberships: [],
    });
    expect(ctx?.resolutionMode).toBe('v1');
    expect(ctx?.user.shop_id).toBe('shop-v1');
  });

  it('supports admin without shop_id', () => {
    const ctx = buildIdentityContext({
      ...base,
      useMembershipAuth: false,
      profile: { userId: 'user-1', role: 'admin' },
    });
    expect(ctx?.user.role).toBe('admin');
    expect(ctx?.user.shop_id).toBeUndefined();
  });
});
