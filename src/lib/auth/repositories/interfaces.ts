/**
 * RetailX V2 Milestone D1.2 — Auth repository contracts
 */

import type { AuthSession } from '../types';
import type { IdentityContext } from '../identity/types';

export interface SupabaseAuthUser {
  id: string;
  email: string;
  userMetadata?: Record<string, unknown>;
}

export interface V1ProfileRecord {
  userId: string;
  shopId?: string;
  role: 'shop_owner' | 'admin';
  email?: string;
  fullName?: string;
  createdAt?: string;
}

export interface MembershipRecord {
  id: string;
  shopId: string;
  userId: string;
  roleSlug: string;
  isPrimary: boolean;
  status: 'active' | 'suspended' | 'revoked';
}

export interface ResolveIdentityOptions {
  useMembershipAuth: boolean;
}

export interface IAuthRepository {
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  refreshSession(): Promise<AuthSession | null>;
  getCurrentUser(): Promise<SupabaseAuthUser | null>;
  fetchV1Profile(userId: string): Promise<V1ProfileRecord | null>;
  fetchMemberships(userId: string): Promise<MembershipRecord[]>;
  resolveIdentity(options: ResolveIdentityOptions): Promise<IdentityContext | null>;
  fetchMainBranchCode(shopId: string): Promise<string | null>;
}
