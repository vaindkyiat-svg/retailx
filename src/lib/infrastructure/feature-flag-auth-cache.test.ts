/**
 * Feature flag cache lifecycle — auth-aware caching and provisioning path
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FEATURE_FLAGS } from './feature-flags';

const authState = vi.hoisted(() => ({
  session: null as { access_token: string; user: { id: string } } | null,
  listener: null as ((event: string, session: unknown) => void) | null,
  featureFlagsResponse: [] as Array<{
    key: string;
    enabled: boolean;
    environments?: Record<string, boolean>;
  }>,
  shopsInsert: vi.fn(),
  provisionInvoke: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: authState.session } })),
      onAuthStateChange: vi.fn((listener: (event: string, session: unknown) => void) => {
        authState.listener = listener;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'feature_flags') {
        return {
          select: vi.fn(async () => ({
            data: authState.session ? authState.featureFlagsResponse : [],
            error: null,
          })),
        };
      }

      if (table === 'shops') {
        return {
          insert: authState.shopsInsert.mockImplementation(() => ({
            select: vi.fn(async () => ({ data: [{ id: 'legacy-shop' }], error: null })),
          })),
        };
      }

      return {
        select: vi.fn(async () => ({ data: [], error: null })),
      };
    }),
    functions: {
      invoke: authState.provisionInvoke,
    },
  },
  createServiceSupabase: vi.fn(() => null),
}));

import {
  fetchFeatureFlags,
  installFeatureFlagAuthSync,
  resetFeatureFlagClientForTests,
  getFeatureFlagCacheStateForTests,
  isFeatureEnabled,
  FEATURE_FLAGS as CLIENT_FLAGS,
} from './feature-flag-client';
import { addShop } from '../database';
import { supabase } from '../supabase';

const V2_FLAG_ROW = {
  key: FEATURE_FLAGS.USE_V2_PROVISIONING,
  enabled: true,
  environments: { development: false, staging: false, production: true },
};

const WRITE_LEGACY_FLAG_ROW = {
  key: FEATURE_FLAGS.WRITE_LEGACY_CREDENTIALS,
  enabled: true,
  environments: { development: true, staging: true, production: true },
};

function mockSession() {
  return { access_token: 'admin-token', user: { id: 'admin-1' } };
}

function emitAuth(event: string, session: typeof authState.session = authState.session) {
  authState.listener?.(event, session);
}

describe('feature flag auth cache lifecycle', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_RETAILX_ENV', 'production');
    resetFeatureFlagClientForTests();
    authState.session = null;
    authState.listener = null;
    authState.featureFlagsResponse = [V2_FLAG_ROW, WRITE_LEGACY_FLAG_ROW];
    authState.shopsInsert.mockClear();
    authState.provisionInvoke.mockReset();
    authState.provisionInvoke.mockResolvedValue({
      data: {
        shopId: 'v2-shop-id',
        ownerUserId: 'owner-1',
        username: 'shopuser',
        temporaryPassword: 'shop@1234',
      },
      error: null,
    });
    installFeatureFlagAuthSync(supabase as never);
  });

  afterEach(() => {
    resetFeatureFlagClientForTests();
  });

  it('anonymous fetch caches correctly', async () => {
    const first = await fetchFeatureFlags();
    const second = await fetchFeatureFlags();

    expect(first[CLIENT_FLAGS.USE_V2_PROVISIONING]).toBe(false);
    expect(second).toBe(first);
    expect(getFeatureFlagCacheStateForTests().cachedAuthTier).toBe('anonymous');
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('login clears cache and authenticated fetch reloads flags', async () => {
    await fetchFeatureFlags();
    expect(getFeatureFlagCacheStateForTests().cachedAuthTier).toBe('anonymous');

    authState.session = mockSession();
    emitAuth('SIGNED_IN', authState.session);

    await vi.waitFor(() => {
      expect(getFeatureFlagCacheStateForTests().cachedAuthTier).toBe('authenticated');
    });

    const flags = await fetchFeatureFlags();
    expect(flags[CLIENT_FLAGS.USE_V2_PROVISIONING]).toBe(true);
    expect(supabase.from).toHaveBeenCalledWith('feature_flags');
  });

  it('logout clears cache', async () => {
    authState.session = mockSession();
    await fetchFeatureFlags();
    expect(getFeatureFlagCacheStateForTests().cachedAuthTier).toBe('authenticated');

    authState.session = null;
    emitAuth('SIGNED_OUT', null);

    expect(getFeatureFlagCacheStateForTests().cachedFlags).toBeNull();
    expect(getFeatureFlagCacheStateForTests().cachedAuthTier).toBeNull();
  });

  it('token refresh invalidates and reloads authenticated flags', async () => {
    authState.session = mockSession();
    await fetchFeatureFlags();
    const callsBefore = vi.mocked(supabase.from).mock.calls.length;

    emitAuth('TOKEN_REFRESHED', authState.session);

    await vi.waitFor(() => {
      expect(vi.mocked(supabase.from).mock.calls.length).toBeGreaterThan(callsBefore);
    });

    expect(getFeatureFlagCacheStateForTests().cachedAuthTier).toBe('authenticated');
  });

  it('never serves anonymous cache after authentication without waiting for auth event', async () => {
    await fetchFeatureFlags();
    expect(getFeatureFlagCacheStateForTests().cachedAuthTier).toBe('anonymous');

    authState.session = mockSession();
    const flags = await fetchFeatureFlags();

    expect(flags[CLIENT_FLAGS.USE_V2_PROVISIONING]).toBe(true);
    expect(getFeatureFlagCacheStateForTests().cachedAuthTier).toBe('authenticated');
  });

  it('Register Shop immediately after login calls addShopV2() not addShopLegacy()', async () => {
    // Cold start: anonymous prefetch (AuthProvider / login page)
    await fetchFeatureFlags();
    expect(await isFeatureEnabled(CLIENT_FLAGS.USE_V2_PROVISIONING)).toBe(false);

    // Admin login
    authState.session = mockSession();
    emitAuth('SIGNED_IN', authState.session);
    await vi.waitFor(() => {
      expect(getFeatureFlagCacheStateForTests().cachedAuthTier).toBe('authenticated');
    });

    const shop = {
      id: '00000000-0000-4000-8000-000000000001',
      shopName: 'Post Login Shop',
      ownerName: 'Owner',
      phone: '+91 99999 00000',
      email: 'owner@example.com',
      address: 'Delhi, UP',
      city: 'Delhi',
      state: 'UP',
      category: 'Grocery',
      gstin: '',
      username: 'shopuser',
      password: 'shop@1234',
      status: 'active' as const,
      plan: 'standard' as const,
      registeredOn: '2026-07-07',
    };

    const saved = await addShop(shop);

    expect(saved?.id).toBe('v2-shop-id');
    expect(authState.provisionInvoke).toHaveBeenCalledTimes(1);
    expect(authState.provisionInvoke).toHaveBeenCalledWith(
      'provision-shop',
      expect.objectContaining({
        body: expect.objectContaining({
          shopName: 'Post Login Shop',
          ownerEmail: 'owner@example.com',
        }),
      })
    );
    expect(authState.shopsInsert).not.toHaveBeenCalled();
  });

  it('authenticated V2 provisioning invokes /functions/v1/provision-shop', async () => {
    authState.session = mockSession();
    emitAuth('SIGNED_IN', authState.session);
    await vi.waitFor(() => {
      expect(getFeatureFlagCacheStateForTests().cachedAuthTier).toBe('authenticated');
    });

    const shop = {
      id: '00000000-0000-4000-8000-000000000002',
      shopName: 'Edge Path Shop',
      ownerName: 'Owner',
      phone: '+91 99999 00001',
      email: 'edge@example.com',
      address: 'Mumbai, MH',
      city: 'Mumbai',
      state: 'MH',
      category: 'Pharmacy',
      gstin: '',
      username: 'edgeuser',
      password: 'shop@5678',
      status: 'active' as const,
      plan: 'standard' as const,
      registeredOn: '2026-07-07',
    };

    await addShop(shop);

    expect(authState.provisionInvoke).toHaveBeenCalledWith(
      'provision-shop',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer admin-token',
        }),
        body: expect.objectContaining({
          shopName: 'Edge Path Shop',
          ownerEmail: 'edge@example.com',
        }),
      })
    );
    expect(authState.shopsInsert).not.toHaveBeenCalled();
  });
});
