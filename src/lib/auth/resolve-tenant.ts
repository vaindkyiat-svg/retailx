/**
 * RetailX V2 Milestone D1.1 — Pure tenant resolver (no I/O)
 */

import type {
  LegacyAuthRole,
  MembershipRoleSlug,
  ResolveTenantInput,
  TenantContext,
} from './types';

function mapRoleSlugToLegacy(roleSlug: MembershipRoleSlug): LegacyAuthRole {
  if (roleSlug === 'platform_admin' || roleSlug === 'admin') {
    return 'admin';
  }
  return 'shop_owner';
}

/**
 * Resolve tenant context from V1 profile and/or V2 membership.
 * When useMembershipAuth is false, always uses user_profiles path (V1 behavior).
 */
export function resolveTenant(input: ResolveTenantInput): TenantContext | null {
  if (!input.useMembershipAuth) {
    return resolveFromProfile(input.profile);
  }

  if (input.membership) {
    return {
      shopId: input.membership.shopId,
      userId: input.membership.userId,
      role: mapRoleSlugToLegacy(input.membership.roleSlug),
      resolutionSource: 'membership',
    };
  }

  return resolveFromProfile(input.profile);
}

function resolveFromProfile(
  profile: ResolveTenantInput['profile']
): TenantContext | null {
  if (!profile?.shopId) {
    return null;
  }

  return {
    shopId: profile.shopId,
    userId: profile.userId,
    role: profile.role,
    resolutionSource: 'user_profile',
  };
}
