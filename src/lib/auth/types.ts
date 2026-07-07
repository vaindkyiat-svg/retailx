/**
 * RetailX V2 Milestone D1.1 — Authentication type definitions
 * Infrastructure only; no runtime auth behavior changes.
 */

/** Mirrors legacy V1 role slugs used in user_profiles */
export type LegacyAuthRole = 'shop_owner' | 'admin';

/** V2 system role slug from memberships */
export type MembershipRoleSlug =
  | 'shop_owner'
  | 'shop_manager'
  | 'cashier'
  | 'platform_admin'
  | string;

export interface AuthUser {
  id: string;
  email: string;
  role: LegacyAuthRole;
  shop_id?: string;
  name?: string;
  created_at?: string;
}

export interface AuthSession {
  accessToken: string;
  expiresAt: number | null;
  userId: string;
  email: string | null;
}

export interface MembershipContext {
  membershipId: string;
  shopId: string;
  userId: string;
  roleSlug: MembershipRoleSlug;
  isPrimary: boolean;
  status: 'active' | 'suspended' | 'revoked';
  source: 'membership';
}

export interface TenantContext {
  shopId: string;
  userId: string;
  role: LegacyAuthRole;
  resolutionSource: 'user_profile' | 'membership';
}

export interface PermissionContext {
  permissions: string[];
  roleSlug: MembershipRoleSlug | LegacyAuthRole;
  source: 'membership' | 'user_profile' | 'none';
}

export type AuthMode = 'legacy' | 'membership';

export interface AuthConfig {
  useMembershipAuth: boolean;
  useMembershipRls: boolean;
  useV2Provisioning: boolean;
}

export interface AuthenticationState {
  mode: AuthMode;
  isAuthenticated: boolean;
  session: AuthSession | null;
  user: AuthUser | null;
  tenant: TenantContext | null;
  membership: MembershipContext | null;
  permissions: PermissionContext | null;
  config: AuthConfig;
  isLoading: boolean;
  error: AuthErrorPayload | null;
}

/** Serializable auth error payload (no stack traces in production logs) */
export interface AuthErrorPayload {
  code: AuthErrorCode;
  message: string;
  recoverable: boolean;
}

export type AuthErrorCode =
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_SESSION_EXPIRED'
  | 'AUTH_USER_NOT_FOUND'
  | 'AUTH_MEMBERSHIP_NOT_FOUND'
  | 'AUTH_PERMISSION_DENIED'
  | 'AUTH_UNKNOWN';

export type SessionEvent =
  | 'INITIAL_SESSION'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'PASSWORD_RECOVERY';

export interface SessionObserverEvent {
  event: SessionEvent;
  session: AuthSession | null;
  timestamp: string;
}

export interface MembershipInput {
  id: string;
  shopId: string;
  userId: string;
  roleSlug: MembershipRoleSlug;
  isPrimary: boolean;
  status: 'active' | 'suspended' | 'revoked';
}

export interface V1ProfileInput {
  userId: string;
  shopId?: string;
  role: LegacyAuthRole;
  email?: string;
}

export interface ResolveMembershipInput {
  useMembershipAuth: boolean;
  userId: string;
  memberships: MembershipInput[];
}

export interface ResolveTenantInput {
  useMembershipAuth: boolean;
  profile: V1ProfileInput | null;
  membership: MembershipContext | null;
}
