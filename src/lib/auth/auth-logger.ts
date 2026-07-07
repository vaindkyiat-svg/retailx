/**
 * RetailX V2 Milestone D1.1 — Auth logger (metadata only, never secrets)
 */

import type { AuthErrorCode, SessionEvent } from './types';

const FORBIDDEN_KEYS = new Set([
  'password',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'secret',
  'serviceRoleKey',
  'service_role_key',
  'authorization',
  'apikey',
  'api_key',
]);

export type AuthLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AuthLogMetadata {
  userId?: string;
  shopId?: string;
  event?: SessionEvent | string;
  code?: AuthErrorCode;
  mode?: 'legacy' | 'membership';
  durationMs?: number;
  [key: string]: string | number | boolean | undefined;
}

function sanitizeMetadata(metadata: AuthLogMetadata): AuthLogMetadata {
  const clean: AuthLogMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (FORBIDDEN_KEYS.has(key)) continue;
    if (typeof value === 'string' && looksLikeSecret(value)) continue;
    clean[key] = value;
  }
  return clean;
}

function looksLikeSecret(value: string): boolean {
  if (value.length > 80) return true;
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(value)) return true;
  if (/^sb_[a-z]+_[A-Za-z0-9]+/.test(value)) return true;
  return false;
}

export function logAuthEvent(
  level: AuthLogLevel,
  message: string,
  metadata: AuthLogMetadata = {}
): void {
  const payload = {
    scope: 'auth',
    level,
    message,
    timestamp: new Date().toISOString(),
    ...sanitizeMetadata(metadata),
  };

  switch (level) {
    case 'error':
      console.error(JSON.stringify(payload));
      break;
    case 'warn':
      console.warn(JSON.stringify(payload));
      break;
    case 'debug':
      if (import.meta.env?.DEV) {
        console.debug(JSON.stringify(payload));
      }
      break;
    default:
      console.info(JSON.stringify(payload));
  }
}
