/**
 * RetailX V2 Milestone D1.2 — Supabase error mapping tests
 */

import { describe, it, expect } from 'vitest';
import { mapSupabaseAuthError, mapProfileFetchError } from './map-errors';

describe('mapSupabaseAuthError', () => {
  it('maps invalid login credentials', () => {
    const err = mapSupabaseAuthError(new Error('Invalid login credentials'));
    expect(err.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('maps session expired', () => {
    const err = mapSupabaseAuthError({ message: 'jwt expired', status: 401 } as Error);
    expect(err.code).toBe('AUTH_SESSION_EXPIRED');
  });

  it('maps unknown errors', () => {
    const err = mapSupabaseAuthError(new Error('network failure'));
    expect(err.code).toBe('AUTH_UNKNOWN');
  });
});

describe('mapProfileFetchError', () => {
  it('maps PGRST116 to user not found', () => {
    const err = mapProfileFetchError({ code: 'PGRST116' });
    expect(err.code).toBe('AUTH_USER_NOT_FOUND');
  });
});
