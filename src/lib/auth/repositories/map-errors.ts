/**
 * RetailX V2 Milestone D1.2 — Map Supabase errors to typed AuthError
 */

import type { AuthError as SupabaseAuthError } from '@supabase/supabase-js';
import { AuthError, createAuthError } from '../errors';

export function mapSupabaseAuthError(error: SupabaseAuthError | Error | null): AuthError {
  if (!error) {
    return createAuthError('AUTH_UNKNOWN');
  }

  const message = (error.message ?? '').toLowerCase();
  const status = 'status' in error ? (error as SupabaseAuthError).status : undefined;

  if (message.includes('invalid login credentials') || message.includes('invalid email or password')) {
    return createAuthError('AUTH_INVALID_CREDENTIALS');
  }

  if (message.includes('email not confirmed')) {
    return createAuthError('AUTH_INVALID_CREDENTIALS', 'Email not confirmed.');
  }

  if (
    status === 401 ||
    message.includes('jwt expired') ||
    message.includes('session expired') ||
    message.includes('refresh_token')
  ) {
    return createAuthError('AUTH_SESSION_EXPIRED');
  }

  if (message.includes('user not found')) {
    return createAuthError('AUTH_USER_NOT_FOUND');
  }

  return createAuthError('AUTH_UNKNOWN', error.message);
}

export function mapProfileFetchError(error: { message?: string; code?: string } | null): AuthError {
  if (!error) return createAuthError('AUTH_USER_NOT_FOUND');

  const code = error.code ?? '';
  if (code === 'PGRST116') {
    return createAuthError('AUTH_USER_NOT_FOUND');
  }

  return createAuthError('AUTH_UNKNOWN', error.message);
}
