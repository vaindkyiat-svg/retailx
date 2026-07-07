/**
 * RetailX V2 Milestone D1.1 — resolveMembership unit tests
 */

import { describe, it, expect } from 'vitest';
import { resolveMembership } from './resolve-membership';
import type { MembershipInput } from '../types';

const memberships: MembershipInput[] = [
  {
    id: 'm1',
    shopId: 'shop-a',
    userId: 'user-1',
    roleSlug: 'cashier',
    isPrimary: false,
    status: 'active',
  },
  {
    id: 'm2',
    shopId: 'shop-b',
    userId: 'user-1',
    roleSlug: 'shop_owner',
    isPrimary: true,
    status: 'active',
  },
];

describe('resolveMembership', () => {
  it('returns null when USE_MEMBERSHIP_AUTH is off', () => {
    const result = resolveMembership({
      useMembershipAuth: false,
      userId: 'user-1',
      memberships,
    });
    expect(result).toBeNull();
  });

  it('returns primary active membership when flag on', () => {
    const result = resolveMembership({
      useMembershipAuth: true,
      userId: 'user-1',
      memberships,
    });
    expect(result).not.toBeNull();
    expect(result?.membershipId).toBe('m2');
    expect(result?.isPrimary).toBe(true);
    expect(result?.source).toBe('membership');
  });

  it('returns null when no active memberships', () => {
    const suspended: MembershipInput[] = [
      { ...memberships[0], status: 'suspended' },
    ];
    const result = resolveMembership({
      useMembershipAuth: true,
      userId: 'user-1',
      memberships: suspended,
    });
    expect(result).toBeNull();
  });

  it('ignores memberships for other users', () => {
    const result = resolveMembership({
      useMembershipAuth: true,
      userId: 'other-user',
      memberships,
    });
    expect(result).toBeNull();
  });
});
