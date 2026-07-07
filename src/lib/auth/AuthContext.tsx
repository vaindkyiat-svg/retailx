/**
 * RetailX V2 Milestone D1.1 — Auth React context
 */

import { createContext, useContext } from 'react';
import type { AuthenticationState } from './types';
import { DEFAULT_AUTH_CONFIG } from './auth-config';

export const INITIAL_AUTH_STATE: AuthenticationState = {
  mode: 'legacy',
  isAuthenticated: false,
  session: null,
  user: null,
  tenant: null,
  membership: null,
  permissions: null,
  config: DEFAULT_AUTH_CONFIG,
  isLoading: true,
  error: null,
};

export interface AuthContextValue extends AuthenticationState {
  /** Re-read feature flags from DB (future milestones) */
  refreshConfig: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

/** Optional hook — returns null outside provider (for gradual adoption) */
export function useAuthOptional(): AuthContextValue | null {
  return useContext(AuthContext);
}
