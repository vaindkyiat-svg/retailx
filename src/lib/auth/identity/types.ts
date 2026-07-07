/**
 * RetailX V2 Milestone D1.2 — Identity context (resolved auth state)
 */

import type {
  AuthUser,
  MembershipContext,
  TenantContext,
  PermissionContext,
} from '../types';

export type IdentityResolutionMode = 'v1' | 'v2';

export interface IdentityContext {
  user: AuthUser;
  tenant: TenantContext | null;
  membership: MembershipContext | null;
  permissions: PermissionContext | null;
  resolutionMode: IdentityResolutionMode;
}

export interface BuildIdentityInput {
  userId: string;
  email: string;
  name?: string;
  createdAt?: string;
  useMembershipAuth: boolean;
  profile: {
    userId: string;
    shopId?: string;
    role: 'shop_owner' | 'admin';
    email?: string;
  } | null;
  memberships: Array<{
    id: string;
    shopId: string;
    userId: string;
    roleSlug: string;
    isPrimary: boolean;
    status: 'active' | 'suspended' | 'revoked';
  }>;
}
