/**
 * RetailX V2 Milestone D1.1 — session store unit tests
 */

import { describe, it, expect, vi } from 'vitest';
import { SessionStore } from './session-store';
import type { AuthSession } from './types';

const sampleSession: AuthSession = {
  accessToken: 'test-token',
  expiresAt: 9999999999,
  userId: 'user-1',
  email: 'test@example.com',
};

describe('SessionStore', () => {
  it('starts with null session', () => {
    const store = new SessionStore();
    expect(store.getSession()).toBeNull();
  });

  it('stores and retrieves session', () => {
    const store = new SessionStore();
    store.setSession(sampleSession, 'SIGNED_IN');
    expect(store.getSession()?.userId).toBe('user-1');
  });

  it('notifies subscribers on change', () => {
    const store = new SessionStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.setSession(sampleSession, 'SIGNED_IN');
    expect(listener).toHaveBeenCalledOnce();
    expect(listener.mock.calls[0][0].event).toBe('SIGNED_IN');
  });

  it('unsubscribe stops notifications', () => {
    const store = new SessionStore();
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    unsub();
    store.setSession(sampleSession, 'SIGNED_IN');
    expect(listener).not.toHaveBeenCalled();
  });

  it('clearSession sets null and emits SIGNED_OUT', () => {
    const store = new SessionStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.setSession(sampleSession, 'SIGNED_IN');
    store.clearSession();
    expect(store.getSession()).toBeNull();
    expect(listener.mock.calls[1][0].event).toBe('SIGNED_OUT');
  });
});

describe('mapSupabaseSession', () => {
  it('maps Supabase session shape', async () => {
    const { mapSupabaseSession } = await import('./session');
    const mapped = mapSupabaseSession({
      access_token: 'abc',
      expires_at: 12345,
      user: { id: 'uid', email: 'a@b.com' },
    } as Parameters<typeof mapSupabaseSession>[0]);
    expect(mapped?.userId).toBe('uid');
    expect(mapped?.email).toBe('a@b.com');
  });

  it('returns null for null session', async () => {
    const { mapSupabaseSession } = await import('./session');
    expect(mapSupabaseSession(null)).toBeNull();
  });
});
