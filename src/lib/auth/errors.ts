/**
 * RetailX V2 Milestone D1.1 — Standard auth error model
 */

import type { AuthErrorCode, AuthErrorPayload } from './types';

const ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password.',
  AUTH_SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  AUTH_USER_NOT_FOUND: 'User account was not found.',
  AUTH_MEMBERSHIP_NOT_FOUND: 'No active membership was found for this user.',
  AUTH_PERMISSION_DENIED: 'You do not have permission to perform this action.',
  AUTH_UNKNOWN: 'An unexpected authentication error occurred.',
};

const RECOVERABLE: Record<AuthErrorCode, boolean> = {
  AUTH_INVALID_CREDENTIALS: true,
  AUTH_SESSION_EXPIRED: true,
  AUTH_USER_NOT_FOUND: false,
  AUTH_MEMBERSHIP_NOT_FOUND: false,
  AUTH_PERMISSION_DENIED: false,
  AUTH_UNKNOWN: true,
};

export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly recoverable: boolean;

  constructor(code: AuthErrorCode, message?: string) {
    const resolved = message ?? ERROR_MESSAGES[code];
    super(resolved);
    this.name = 'AuthError';
    this.code = code;
    this.recoverable = RECOVERABLE[code];
  }

  toPayload(): AuthErrorPayload {
    return {
      code: this.code,
      message: this.message,
      recoverable: this.recoverable,
    };
  }
}

export function createAuthError(code: AuthErrorCode, message?: string): AuthError {
  return new AuthError(code, message);
}

export function isAuthError(value: unknown): value is AuthError {
  return value instanceof AuthError;
}

export function toAuthErrorPayload(value: unknown): AuthErrorPayload {
  if (isAuthError(value)) return value.toPayload();
  if (value instanceof Error) {
    return {
      code: 'AUTH_UNKNOWN',
      message: value.message,
      recoverable: true,
    };
  }
  return {
    code: 'AUTH_UNKNOWN',
    message: ERROR_MESSAGES.AUTH_UNKNOWN,
    recoverable: true,
  };
}
