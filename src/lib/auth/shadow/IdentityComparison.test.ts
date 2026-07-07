/**
 * RetailX V2 Milestone D1.3 — Identity comparison tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  compareIdentitySnapshots,
  snapshotFromIdentity,
} from './IdentityComparison';
import type { IdentityContext } from '../identity/types';
import { shadowMetrics } from './shadow-metrics';
import { identityValidationLog } from './identity-validation-log';

const baseContext = (overrides: Partial<IdentityContext> = {}): IdentityContext => ({
  user: {
    id: 'user-1',
    email: 'a@b.com',
    role: 'shop_owner',
    shop_id: 'shop-1',
    name: 'Owner',
  },
  tenant: {
    shopId: 'shop-1',
    userId: 'user-1',
    role: 'shop_owner',
    resolutionSource: 'user_profile',
  },
  membership: null,
  permissions: { permissions: [], roleSlug: 'shop_owner', source: 'user_profile' },
  resolutionMode: 'v1',
  ...overrides,
});

describe('IdentityComparison', () => {
  beforeEach(() => {
    shadowMetrics.reset();
    identityValidationLog.clear();
  });

  it('perfect match when V1 and V2 align', () => {
    const ctx = baseContext({
      membership: {
        membershipId: 'm1',
        shopId: 'shop-1',
        userId: 'user-1',
        roleSlug: 'shop_owner',
        isPrimary: true,
        status: 'active',
        source: 'membership',
      },
      resolutionMode: 'v2',
    });

    const snap = snapshotFromIdentity(ctx, {
      accessToken: 'x',
      expiresAt: 999,
      userId: 'user-1',
      email: 'a@b.com',
    }, 'MAIN');

    const result = compareIdentitySnapshots(snap, snap, {
      correlationId: 'test-1',
      durationMs: 5,
    });

    expect(result.outcome).toBe('MATCH');
    expect(result.mismatches).toHaveLength(0);
  });

  it('detects WRONG_SHOP mismatch', () => {
    const v1 = snapshotFromIdentity(baseContext(), null, 'MAIN');
    const v2 = snapshotFromIdentity(
      baseContext({ user: { ...baseContext().user, shop_id: 'shop-2' } }),
      null,
      'MAIN'
    );

    const result = compareIdentitySnapshots(v1, v2, {
      correlationId: 'test-2',
      durationMs: 8,
    });

    expect(result.outcome).toBe('MISMATCH');
    expect(result.categories).toContain('WRONG_SHOP');
  });

  it('detects WRONG_ROLE mismatch', () => {
    const v1 = snapshotFromIdentity(baseContext(), null, null);
    const v2 = snapshotFromIdentity(
      baseContext({ user: { ...baseContext().user, role: 'admin' } }),
      null,
      null
    );

    const result = compareIdentitySnapshots(v1, v2, {
      correlationId: 'test-3',
      durationMs: 6,
    });

    expect(result.categories).toContain('WRONG_ROLE');
  });

  it('detects MISSING_MEMBERSHIP when V2 has no membership', () => {
    const v1 = snapshotFromIdentity(baseContext(), null, null);
    const v2 = snapshotFromIdentity(
      baseContext({ membership: null, resolutionMode: 'v2' }),
      null,
      null
    );

    const result = compareIdentitySnapshots(v1, v2, {
      correlationId: 'test-4',
      durationMs: 7,
    });

    expect(result.categories).toContain('MISSING_MEMBERSHIP');
  });

  it('detects WRONG_BRANCH mismatch', () => {
    const v1 = snapshotFromIdentity(baseContext(), null, 'MAIN');
    const v2 = snapshotFromIdentity(baseContext(), null, 'OTHER');

    const result = compareIdentitySnapshots(v1, v2, {
      correlationId: 'test-5',
      durationMs: 4,
    });

    expect(result.categories).toContain('WRONG_BRANCH');
  });

  it('detects ORPHAN_USER when snapshot missing', () => {
    const result = compareIdentitySnapshots(null, null, {
      correlationId: 'test-6',
      durationMs: 3,
    });

    expect(result.outcome).toBe('MISMATCH');
    expect(result.categories).toContain('ORPHAN_USER');
  });

  it('detects INVALID_TENANT when tenant shop differs', () => {
    const v1 = snapshotFromIdentity(baseContext(), null, null);
    const v2 = snapshotFromIdentity(
      baseContext({
        tenant: {
          shopId: 'shop-x',
          userId: 'user-1',
          role: 'shop_owner',
          resolutionSource: 'membership',
        },
      }),
      null,
      null
    );

    const result = compareIdentitySnapshots(v1, v2, {
      correlationId: 'test-7',
      durationMs: 9,
    });

    expect(result.categories).toContain('INVALID_TENANT');
  });

  it('always marks v1Authoritative and shadowDiscarded', () => {
    const result = compareIdentitySnapshots(
      snapshotFromIdentity(baseContext(), null, null),
      snapshotFromIdentity(baseContext(), null, null),
      { correlationId: 'test-8', durationMs: 1 }
    );

    expect(result.v1Authoritative).toBe(true);
    expect(result.shadowDiscarded).toBe(true);
  });
});
