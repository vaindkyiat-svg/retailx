/**
 * RetailX V2 Milestone D1.2 — Pure identity resolution (V1 / V2 dual-read)
 */

import { resolveMembership } from '../resolve-membership';
import { resolveTenant } from '../resolve-tenant';
import type { BuildIdentityInput, IdentityContext } from './types';

/**
 * Build a complete identity context from raw profile and membership data.
 * Flag routing is decided by AuthService before calling — useMembershipAuth passed in.
 */
export function buildIdentityContext(input: BuildIdentityInput): IdentityContext | null {
  const membership = resolveMembership({
    useMembershipAuth: input.useMembershipAuth,
    userId: input.userId,
    memberships: input.memberships,
  });

  const tenant = resolveTenant({
    useMembershipAuth: input.useMembershipAuth,
    profile: input.profile
      ? {
          userId: input.profile.userId,
          shopId: input.profile.shopId,
          role: input.profile.role,
          email: input.profile.email,
        }
      : null,
    membership,
  });

  const shopId = tenant?.shopId ?? input.profile?.shopId;
  const role = tenant?.role ?? input.profile?.role ?? 'shop_owner';

  const user = {
    id: input.userId,
    email: input.email,
    role,
    shop_id: shopId,
    name: input.name ?? input.email,
    created_at: input.createdAt,
  };

  const permissions: IdentityContext['permissions'] = {
    permissions: [],
    roleSlug: membership?.roleSlug ?? role,
    source: membership ? 'membership' : input.profile ? 'user_profile' : 'none',
  };

  return {
    user,
    tenant,
    membership,
    permissions,
    resolutionMode: input.useMembershipAuth && membership ? 'v2' : 'v1',
  };
}

/**
 * Resolve identity from repository-fetched data.
 * Alias for buildIdentityContext used by repository layer.
 */
export function resolveIdentity(input: BuildIdentityInput): IdentityContext | null {
  return buildIdentityContext(input);
}
