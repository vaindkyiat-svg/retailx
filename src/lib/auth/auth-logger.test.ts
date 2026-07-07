/**
 * RetailX V2 Milestone D1.1 — auth logger unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logAuthEvent } from './auth-logger';

describe('auth-logger', () => {
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs structured metadata', () => {
    logAuthEvent('info', 'Test event', { userId: 'u1', mode: 'legacy' });
    expect(infoSpy).toHaveBeenCalledOnce();
    const payload = JSON.parse(String(infoSpy.mock.calls[0][0]));
    expect(payload.scope).toBe('auth');
    expect(payload.userId).toBe('u1');
    expect(payload.message).toBe('Test event');
  });

  it('strips password from metadata', () => {
    logAuthEvent('info', 'Login attempt', {
      userId: 'u1',
      password: 'secret123',
    });
    const payload = JSON.parse(String(infoSpy.mock.calls[0][0]));
    expect(payload.password).toBeUndefined();
  });

  it('strips token-like values from metadata', () => {
    logAuthEvent('info', 'Token event', {
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.test',
    });
    const payload = JSON.parse(String(infoSpy.mock.calls[0][0]));
    expect(payload.token).toBeUndefined();
  });

  it('uses error level for errors', () => {
    logAuthEvent('error', 'Failure', { code: 'AUTH_UNKNOWN' });
    expect(errorSpy).toHaveBeenCalledOnce();
  });
});
