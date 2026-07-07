/**
 * RetailX V2 Milestone D1.2 — Mock auth repository for tests
 */

import type { AuthSession } from '../types';
import type { IdentityContext } from '../identity/types';
import { resolveIdentity } from '../identity/resolve-identity';
import type {
  IAuthRepository,
  MembershipRecord,
  ResolveIdentityOptions,
  SupabaseAuthUser,
  V1ProfileRecord,
} from './interfaces';
import { createAuthError } from '../errors';

export interface MockAuthRepositoryState {
  session: AuthSession | null;
  supabaseUser: SupabaseAuthUser | null;
  profile: V1ProfileRecord | null;
  memberships: MembershipRecord[];
  signInShouldFail?: boolean;
  signOutShouldFail?: boolean;
}

export class MockAuthRepository implements IAuthRepository {
  private state: MockAuthRepositoryState;

  constructor(initial: Partial<MockAuthRepositoryState> = {}) {
    this.state = {
      session: null,
      supabaseUser: null,
      profile: null,
      memberships: [],
      ...initial,
    };
  }

  setState(patch: Partial<MockAuthRepositoryState>): void {
    this.state = { ...this.state, ...patch };
  }

  getState(): MockAuthRepositoryState {
    return { ...this.state };
  }

  async signIn(email: string, password: string): Promise<void> {
    if (this.state.signInShouldFail || password === 'wrong') {
      throw createAuthError('AUTH_INVALID_CREDENTIALS');
    }
    if (!this.state.supabaseUser) {
      throw createAuthError('AUTH_INVALID_CREDENTIALS');
    }
    this.state.session = {
      accessToken: 'mock-token',
      expiresAt: Date.now() + 3600_000,
      userId: this.state.supabaseUser.id,
      email: this.state.supabaseUser.email,
    };
  }

  async signOut(): Promise<void> {
    if (this.state.signOutShouldFail) {
      throw createAuthError('AUTH_UNKNOWN');
    }
    this.state.session = null;
  }

  async getSession(): Promise<AuthSession | null> {
    return this.state.session;
  }

  async refreshSession(): Promise<AuthSession | null> {
    return this.state.session;
  }

  async getCurrentUser(): Promise<SupabaseAuthUser | null> {
    return this.state.supabaseUser;
  }

  async fetchV1Profile(userId: string): Promise<V1ProfileRecord | null> {
    if (!this.state.profile || this.state.profile.userId !== userId) {
      throw createAuthError('AUTH_USER_NOT_FOUND');
    }
    return this.state.profile;
  }

  async fetchMemberships(userId: string): Promise<MembershipRecord[]> {
    return this.state.memberships.filter((m) => m.userId === userId);
  }

  async resolveIdentity(options: ResolveIdentityOptions): Promise<IdentityContext | null> {
    const user = this.state.supabaseUser;
    if (!user) return null;

    let profile = this.state.profile;
    if (!profile && !options.useMembershipAuth) {
      throw createAuthError('AUTH_USER_NOT_FOUND');
    }

    const memberships = options.useMembershipAuth ? this.state.memberships : [];

    return resolveIdentity({
      userId: user.id,
      email: user.email,
      name: profile?.fullName ?? user.email,
      createdAt: profile?.createdAt,
      useMembershipAuth: options.useMembershipAuth,
      profile: profile
        ? {
            userId: profile.userId,
            shopId: profile.shopId,
            role: profile.role,
            email: profile.email,
          }
        : null,
      memberships,
    });
  }

  async fetchMainBranchCode(shopId: string): Promise<string | null> {
    if (!shopId) return null;
    return 'MAIN';
  }
}
