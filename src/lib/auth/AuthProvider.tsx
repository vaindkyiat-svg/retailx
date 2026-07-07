/**
 * RetailX V2 Milestone D1.2 — Auth provider
 *
 * Coordinates AuthService + session observer. Feature flags remain OFF by default.
 */

import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from '../supabase';
import { AuthContext, INITIAL_AUTH_STATE, type AuthContextValue } from './AuthContext';
import { getAuthConfig, resolveAuthMode } from './auth-config';
import { logAuthEvent } from './auth-logger';
import { sessionManager } from './session';
import { authService } from './services';
import type { AuthenticationState } from './types';
import { toAuthErrorPayload } from './errors';

export interface AuthProviderProps {
  children: ReactNode;
}

async function syncIdentityFromService(): Promise<Partial<AuthenticationState>> {
  const identity = await authService.resolveIdentityContext();

  if (!identity) {
    return {
      user: null,
      tenant: null,
      membership: null,
      permissions: null,
      isAuthenticated: false,
    };
  }

  return {
    user: identity.user,
    tenant: identity.tenant,
    membership: identity.membership,
    permissions: identity.permissions,
    isAuthenticated: true,
    mode: identity.resolutionMode === 'v2' ? 'membership' : 'legacy',
  };
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthenticationState>(INITIAL_AUTH_STATE);

  const refreshConfig = useCallback(async () => {
    const config = await getAuthConfig();
    const mode = resolveAuthMode(config);

    setState((prev) => ({
      ...prev,
      config,
      mode,
    }));

    logAuthEvent('debug', 'Auth config refreshed', { mode });
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const config = await getAuthConfig();
        const mode = resolveAuthMode(config);

        if (!mounted) return;

        const patch = await syncIdentityFromService();
        if (!mounted) return;

        setState((prev) => ({
          ...prev,
          ...patch,
          config,
          mode,
          isLoading: false,
        }));

        logAuthEvent('info', 'Auth provider initialized', { mode });
      } catch (err) {
        if (!mounted) return;

        logAuthEvent('error', 'Auth provider init failed', {
          code: 'AUTH_UNKNOWN',
        });

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: toAuthErrorPayload(err),
        }));
      }
    }

    void init();
  }, []);

  useEffect(() => {
    const stopObserver = sessionManager.start(supabase, (event) => {
      setState((prev) => ({
        ...prev,
        session: event.session,
        isAuthenticated: event.session !== null,
      }));

      if (
        event.event === 'SIGNED_IN' ||
        event.event === 'TOKEN_REFRESHED' ||
        event.event === 'INITIAL_SESSION'
      ) {
        void syncIdentityFromService().then((patch) => {
          setState((prev) => ({ ...prev, ...patch }));
        });
      }

      if (event.event === 'SIGNED_OUT') {
        setState((prev) => ({
          ...prev,
          user: null,
          tenant: null,
          membership: null,
          permissions: null,
          isAuthenticated: false,
        }));
      }

      logAuthEvent('debug', 'Auth provider session update', {
        event: event.event,
        userId: event.session?.userId,
      });
    });

    return () => {
      stopObserver();
      sessionManager.stop();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      refreshConfig,
    }),
    [state, refreshConfig]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
