/**
 * RetailX V2 Milestone D1.1 — auth errors unit tests
 */

import { describe, it, expect } from 'vitest';
import {
  AuthError,
  createAuthError,
  isAuthError,
  toAuthErrorPayload,
} from './errors';

describe('auth errors', () => {
  it('creates AuthError with standard message', () => {
    const err = createAuthError('AUTH_INVALID_CREDENTIALS');
    expect(err.code).toBe('AUTH_INVALID_CREDENTIALS');
    expect(err.message).toContain('Invalid');
    expect(err.recoverable).toBe(true);
  });

  it('supports custom message', () => {
    const err = createAuthError('AUTH_UNKNOWN', 'Custom failure');
    expect(err.message).toBe('Custom failure');
  });

  it('toPayload returns serializable object', () => {
    const payload = createAuthError('AUTH_SESSION_EXPIRED').toPayload();
    expect(payload.code).toBe('AUTH_SESSION_EXPIRED');
    expect(payload.recoverable).toBe(true);
  });

  it('isAuthError identifies AuthError instances', () => {
    expect(isAuthError(createAuthError('AUTH_USER_NOT_FOUND'))).toBe(true);
    expect(isAuthError(new Error('nope'))).toBe(false);
  });

  it('toAuthErrorPayload handles generic Error', () => {
    const payload = toAuthErrorPayload(new Error('network'));
    expect(payload.code).toBe('AUTH_UNKNOWN');
    expect(payload.message).toBe('network');
  });

  it('defines all required error codes', () => {
    const codes = [
      'AUTH_INVALID_CREDENTIALS',
      'AUTH_SESSION_EXPIRED',
      'AUTH_USER_NOT_FOUND',
      'AUTH_MEMBERSHIP_NOT_FOUND',
      'AUTH_PERMISSION_DENIED',
      'AUTH_UNKNOWN',
    ] as const;
    for (const code of codes) {
      expect(createAuthError(code).code).toBe(code);
    }
  });
});
