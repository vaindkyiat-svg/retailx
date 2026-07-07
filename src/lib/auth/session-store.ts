/**
 * RetailX V2 Milestone D1.1 — In-memory session store
 */

import type { AuthSession, SessionObserverEvent } from './types';

type SessionListener = (event: SessionObserverEvent) => void;

export class SessionStore {
  private session: AuthSession | null = null;
  private listeners = new Set<SessionListener>();

  getSession(): AuthSession | null {
    return this.session;
  }

  setSession(session: AuthSession | null, event: SessionObserverEvent['event']): void {
    this.session = session;
    this.emit({
      event,
      session,
      timestamp: new Date().toISOString(),
    });
  }

  clearSession(): void {
    this.setSession(null, 'SIGNED_OUT');
  }

  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(payload: SessionObserverEvent): void {
    for (const listener of this.listeners) {
      listener(payload);
    }
  }
}

/** Shared session store instance for the auth module */
export const sessionStore = new SessionStore();
