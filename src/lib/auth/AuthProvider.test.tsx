/**
 * RetailX V2 Milestone D1.2 — AuthProvider unit tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AuthProvider } from './AuthProvider';
import { useAuth } from './AuthContext';

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn((_cb) => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(),
  },
}));

vi.mock('../infrastructure/feature-flag-client', () => ({
  fetchFeatureFlags: vi.fn().mockResolvedValue({
    USE_MEMBERSHIP_AUTH: false,
    USE_MEMBERSHIP_RLS: false,
    USE_V2_PROVISIONING: false,
    USE_V2_CHECKOUT: false,
    WRITE_LEGACY_CREDENTIALS: true,
    ENABLE_EDGE_FUNCTIONS: false,
  }),
  isFeatureEnabledSync: vi.fn().mockReturnValue(false),
  FEATURE_FLAGS: {},
}));

vi.mock('./services', () => ({
  authService: {
    resolveIdentityContext: vi.fn().mockResolvedValue(null),
  },
}));

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="mode">{auth.mode}</span>
      <span data-testid="loading">{String(auth.isLoading)}</span>
      <span data-testid="membership-auth">{String(auth.config.useMembershipAuth)}</span>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders children', async () => {
    render(
      <AuthProvider>
        <span>child</span>
      </AuthProvider>
    );
    expect(screen.getByText('child')).toBeDefined();
  });

  it('initializes in legacy mode with flags off', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('mode').textContent).toBe('legacy');
    expect(screen.getByTestId('membership-auth').textContent).toBe('false');
  });

  it('starts session observer', async () => {
    const { supabase } = await import('../supabase');
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(supabase.auth.onAuthStateChange).toHaveBeenCalled();
    });
  });
});
