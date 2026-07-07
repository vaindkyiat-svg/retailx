/**
 * RetailX V2 Milestone D1.2 — Auth service singleton factory
 */

import { supabase } from '../../supabase';
import { SupabaseAuthRepository } from '../repositories/SupabaseAuthRepository';
import { AuthService } from './AuthService';
import type { IAuthRepository } from '../repositories/interfaces';

let cachedService: AuthService | null = null;

export function createAuthService(repository?: IAuthRepository): AuthService {
  return new AuthService(repository ?? new SupabaseAuthRepository(supabase));
}

export function getAuthService(): AuthService {
  if (!cachedService) {
    cachedService = createAuthService();
  }
  return cachedService;
}

/** Application-facing singleton */
export const authService = getAuthService();
