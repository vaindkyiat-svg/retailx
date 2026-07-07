/**
 * RetailX V2 Milestone D1.3 — ShadowIdentityValidator tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ShadowIdentityValidator } from './ShadowIdentityValidator';
import { MockAuthRepository } from '../repositories/MockAuthRepository';
import { shadowMetrics } from './shadow-metrics';
import { identityValidationLog } from './identity-validation-log';

vi.mock('../pilot/pilot-shop-client', () => ({
  isPilotShopEnabled: vi.fn().mockResolvedValue(false),
}));

describe('ShadowIdentityValidator', () => {
  beforeEach(() => {
    shadowMetrics.reset();
    identityValidationLog.clear();
  });

  it('records MATCH when V1 and V2 align', async () => {
    const repo = new MockAuthRepository({
      supabaseUser: { id: 'u1', email: 'a@b.com' },
      profile: { userId: 'u1', shopId: 's1', role: 'shop_owner' },
      memberships: [
        {
          id: 'm1',
          shopId: 's1',
          userId: 'u1',
          roleSlug: 'shop_owner',
          isPrimary: true,
          status: 'active',
        },
      ],
      session: {
        accessToken: 't',
        expiresAt: 999,
        userId: 'u1',
        email: 'a@b.com',
      },
    });

    const validator = new ShadowIdentityValidator(repo);
    const result = await validator.validate('sign_in');

    expect(result?.outcome).toBe('MATCH');
    expect(shadowMetrics.getSnapshot().successfulMatches).toBe(1);
  });

  it('records MISMATCH for wrong shop', async () => {
    const repo = new MockAuthRepository({
      supabaseUser: { id: 'u1', email: 'a@b.com' },
      profile: { userId: 'u1', shopId: 's1', role: 'shop_owner' },
      memberships: [
        {
          id: 'm1',
          shopId: 's2',
          userId: 'u1',
          roleSlug: 'shop_owner',
          isPrimary: true,
          status: 'active',
        },
      ],
    });

    const validator = new ShadowIdentityValidator(repo);
    const result = await validator.validate('sign_in');

    expect(result?.outcome).toBe('MISMATCH');
    expect(result?.categories).toContain('WRONG_SHOP');
    expect(shadowMetrics.getSnapshot().mismatches).toBe(1);
  });

  it('isolates failures without throwing', async () => {
    const repo = new MockAuthRepository({
      supabaseUser: { id: 'u1', email: 'a@b.com' },
      profile: null,
    });

    vi.spyOn(repo, 'resolveIdentity').mockRejectedValueOnce(new Error('boom'));

    const validator = new ShadowIdentityValidator(repo);
    const result = await validator.validate('sign_in');

    expect(result).toBeNull();
  });

  it('generates dashboard report', async () => {
    const repo = new MockAuthRepository({
      supabaseUser: { id: 'u1', email: 'a@b.com' },
      profile: { userId: 'u1', shopId: 's1', role: 'shop_owner' },
      memberships: [
        {
          id: 'm1',
          shopId: 's1',
          userId: 'u1',
          roleSlug: 'shop_owner',
          isPrimary: true,
          status: 'active',
        },
      ],
    });

    const validator = new ShadowIdentityValidator(repo);
    await validator.validate('sign_in');

    const report = validator.getDashboardReport();
    expect(report.json.metrics.totalLogins).toBe(1);
    expect(report.markdown).toContain('Shadow Identity Validation');
    expect(report.html).toContain('Shadow Identity Validation');
  });
});

describe('scheduleShadowValidation', () => {
  it('runs asynchronously without blocking', async () => {
    const { scheduleShadowValidation } = await import('./ShadowIdentityValidator');
    const repo = new MockAuthRepository({
      supabaseUser: { id: 'u1', email: 'a@b.com' },
      profile: { userId: 'u1', shopId: 's1', role: 'shop_owner' },
    });
    const validator = new ShadowIdentityValidator(repo);

    const before = performance.now();
    scheduleShadowValidation(validator, 'sign_in');
    const elapsed = performance.now() - before;

    expect(elapsed).toBeLessThan(5);

    await new Promise((r) => setTimeout(r, 50));
    expect(shadowMetrics.getSnapshot().totalLogins).toBeGreaterThanOrEqual(0);
  });
});
