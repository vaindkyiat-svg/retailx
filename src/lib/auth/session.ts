/**
 * RetailX V2 Milestone D1.1 — Session manager and Supabase observer
 */

import type { SupabaseClient, Session, AuthChangeEvent } from '@supabase/supabase-js';
import type { AuthSession, SessionEvent, SessionObserverEvent } from './types';
import { sessionStore } from './session-store';
import { logAuthEvent } from './auth-logger';

const AUTH_EVENT_MAP: Record<AuthChangeEvent, SessionEvent> = {
  INITIAL_SESSION: 'INITIAL_SESSION',
  SIGNED_IN: 'SIGNED_IN',
  SIGNED_OUT: 'SIGNED_OUT',
  TOKEN_REFRESHED: 'TOKEN_REFRESHED',
  USER_UPDATED: 'USER_UPDATED',
  PASSWORD_RECOVERY: 'PASSWORD_RECOVERY',
};

export function mapSupabaseSession(session: Session | null): AuthSession | null {
  if (!session?.user) return null;

  return {
    accessToken: session.access_token,
    expiresAt: session.expires_at ?? null,
    userId: session.user.id,
    email: session.user.email ?? null,
  };
}

export type SessionObserverCallback = (event: SessionObserverEvent) => void;

export class SessionObserver {
  private unsubscribe: (() => void) | null = null;

  start(client: SupabaseClient, onEvent?: SessionObserverCallback): () => void {
    this.stop();

    const { data } = client.auth.onAuthStateChange((event, session) => {
      const mappedEvent = AUTH_EVENT_MAP[event] ?? 'INITIAL_SESSION';
      const authSession = mapSupabaseSession(session);

      sessionStore.setSession(authSession, mappedEvent);

      logAuthEvent('debug', 'Session state changed', {
        event: mappedEvent,
        userId: authSession?.userId,
      });

      onEvent?.({
        event: mappedEvent,
        session: authSession,
        timestamp: new Date().toISOString(),
      });
    });

    this.unsubscribe = () => {
      data.subscription.unsubscribe();
    };

    return () => this.stop();
  }

  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}

export class SessionManager {
  readonly store = sessionStore;
  readonly observer = new SessionObserver();

  start(client: SupabaseClient, onEvent?: SessionObserverCallback): () => void {
    logAuthEvent('debug', 'Session manager started');
    return this.observer.start(client, onEvent);
  }

  stop(): void {
    this.observer.stop();
    logAuthEvent('debug', 'Session manager stopped');
  }

  getSession(): AuthSession | null {
    return this.store.getSession();
  }
}

export const sessionManager = new SessionManager();

/**
 * Convenience wrapper around Supabase onAuthStateChange.
 * Does not modify login behavior — passive observation only.
 */
export function createSupabaseSessionObserver(
  client: SupabaseClient,
  onEvent?: SessionObserverCallback
): () => void {
  return sessionManager.start(client, onEvent);
}
