/**
 * RetailX V2 Milestone D1.2 + D1.4 — AuthService tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from './AuthService';
import { MockAuthRepository } from '../repositories/MockAuthRepository';
import { pilotMetrics } from '../pilot/pilot-metrics';
import { setPilotShopCacheForTests, clearPilotShopCache } from '../pilot/pilot-shop-client';

vi.mock('../auth-config', () => ({
  getAuthConfig: vi.fn().mockResolvedValue({
    useMembershipAuth: false,
    useMembershipRls: false,
    useV2Provisioning: false,
  }),
}));

import { getAuthConfig } from '../auth-config';

describe('AuthService', () => {
  const mockUser = { id: 'u1', email: 'a@b.com' };
  const mockProfile = {
    userId: 'u1',
    shopId: 'shop-1',
    role: 'shop_owner' as const,
    fullName: 'Owner',
  };

  let repository: MockAuthRepository;
  let service: AuthService;

  beforeEach(() => {
    pilotMetrics.reset();
    clearPilotShopCache();
    setPilotShopCacheForTests([]);

    vi.mocked(getAuthConfig).mockResolvedValue({
      useMembershipAuth: false,
      useMembershipRls: false,
      useV2Provisioning: false,
    });
    repository = new MockAuthRepository({
      supabaseUser: mockUser,
      profile: mockProfile,
    });
    service = new AuthService(repository);
  });

  it('signIn returns user on success (V1 path)', async () => {
    const user = await service.signIn('a@b.com', 'password');
    expect(user?.id).toBe('u1');
    expect(user?.shop_id).toBe('shop-1');
    expect(service.getLastAuthPath()?.source).toBe('legacy');
  });

  it('signIn returns null on invalid credentials', async () => {
    const user = await service.signIn('a@b.com', 'wrong');
    expect(user).toBeNull();
  });

  it('signOut returns true on success', async () => {
    expect(await service.signOut()).toBe(true);
  });

  it('getCurrentUser resolves V1 profile when flag off and not pilot', async () => {
    const user = await service.getCurrentUser();
    expect(user?.shop_id).toBe('shop-1');
    expect(service.getLastAuthPath()?.source).toBe('legacy');
  });

  it('routes to V2 membership when global flag on', async () => {
    vi.mocked(getAuthConfig).mockResolvedValue({
      useMembershipAuth: true,
      useMembershipRls: false,
      useV2Provisioning: false,
    });

    repository.setState({
      memberships: [
        {
          id: 'm1',
          shopId: 'shop-v2',
          userId: 'u1',
          roleSlug: 'shop_owner',
          isPrimary: true,
          status: 'active',
        },
      ],
    });

    const identity = await service.resolveIdentityContext();
    expect(identity?.resolutionMode).toBe('v2');
    expect(identity?.user.shop_id).toBe('shop-v2');
    expect(service.getLastAuthPath()?.source).toBe('global');
  });

  it('routes pilot shop to V2 when global flag off', async () => {
    setPilotShopCacheForTests([
      {
        id: 'p1',
        shopId: 'shop-1',
        enabled: true,
        enabledBy: 'ops',
        enabledAt: null,
        notes: null,
      },
    ]);

    repository.setState({
      memberships: [
        {
          id: 'm1',
          shopId: 'shop-v2-pilot',
          userId: 'u1',
          roleSlug: 'shop_owner',
          isPrimary: true,
          status: 'active',
        },
      ],
    });

    const identity = await service.resolveIdentityContext();
    expect(identity?.resolutionMode).toBe('v2');
    expect(identity?.user.shop_id).toBe('shop-v2-pilot');
    expect(service.getLastAuthPath()?.source).toBe('pilot');
  });

  it('non-pilot shop stays on V1 when another shop is pilot', async () => {
    setPilotShopCacheForTests([
      {
        id: 'p1',
        shopId: 'shop-other',
        enabled: true,
        enabledBy: 'ops',
        enabledAt: null,
        notes: null,
      },
    ]);

    repository.setState({
      profile: { ...mockProfile, shopId: 'shop-1' },
      memberships: [
        {
          id: 'm1',
          shopId: 'shop-v2',
          userId: 'u1',
          roleSlug: 'shop_owner',
          isPrimary: true,
          status: 'active',
        },
      ],
    });

    const identity = await service.resolveIdentityContext();
    expect(identity?.resolutionMode).toBe('v1');
    expect(identity?.user.shop_id).toBe('shop-1');
    expect(service.getLastAuthPath()?.source).toBe('legacy');
  });

  it('rollback: disabling pilot reverts shop to V1', async () => {
    setPilotShopCacheForTests([
      {
        id: 'p1',
        shopId: 'shop-1',
        enabled: true,
        enabledBy: 'ops',
        enabledAt: null,
        notes: null,
      },
    ]);

    repository.setState({
      memberships: [
        {
          id: 'm1',
          shopId: 'shop-v2',
          userId: 'u1',
          roleSlug: 'shop_owner',
          isPrimary: true,
          status: 'active',
        },
      ],
    });

    let identity = await service.resolveIdentityContext();
    expect(identity?.resolutionMode).toBe('v2');

    setPilotShopCacheForTests([
      {
        id: 'p1',
        shopId: 'shop-1',
        enabled: false,
        enabledBy: 'ops',
        enabledAt: null,
        notes: 'rollback',
      },
    ]);

    identity = await service.resolveIdentityContext();
    expect(identity?.resolutionMode).toBe('v1');
    expect(identity?.user.shop_id).toBe('shop-1');
    expect(service.getLastAuthPath()?.source).toBe('legacy');
  });

  it('never exposes raw repository errors from signIn', async () => {
    repository.setState({ signInShouldFail: true });
    const user = await service.signIn('a@b.com', 'password');
    expect(user).toBeNull();
  });

  it('signIn returns user before shadow validation completes', async () => {
    const started = performance.now();
    const user = await service.signIn('a@b.com', 'password');
    const elapsed = performance.now() - started;

    expect(user?.id).toBe('u1');
    expect(elapsed).toBeLessThan(50);
  });

  it('exposes shadow dashboard report without affecting session', async () => {
    await service.signIn('a@b.com', 'password');
    await new Promise((r) => setTimeout(r, 30));

    const report = service.getShadowDashboardReport();
    expect(report.json.mode).toBe('shadow');
    expect(report.markdown).toContain('Shadow Identity Validation');

    const sessionUser = await service.getCurrentUser();
    expect(sessionUser?.shop_id).toBe('shop-1');
  });

  it('exposes pilot dashboard report', async () => {
    setPilotShopCacheForTests([
      {
        id: 'p1',
        shopId: 'shop-1',
        enabled: true,
        enabledBy: 'ops',
        enabledAt: null,
        notes: null,
      },
    ]);

    await service.signIn('a@b.com', 'password');
    const report = await service.getPilotDashboardReport();
    expect(report.json.mode).toBe('pilot');
    expect(report.json.metrics.loginSuccess).toBeGreaterThanOrEqual(1);
  });

  it('handles concurrent logins without cross-contamination', async () => {
    const repo2 = new MockAuthRepository({
      supabaseUser: { id: 'u2', email: 'b@b.com' },
      profile: {
        userId: 'u2',
        shopId: 'shop-2',
        role: 'shop_owner',
        fullName: 'Owner 2',
      },
    });
    const service2 = new AuthService(repo2);

    const [u1, u2] = await Promise.all([
      service.signIn('a@b.com', 'password'),
      service2.signIn('b@b.com', 'password'),
    ]);

    expect(u1?.shop_id).toBe('shop-1');
    expect(u2?.shop_id).toBe('shop-2');
  });
});
