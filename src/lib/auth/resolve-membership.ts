/**
 * RetailX V2 Milestone D1.1 — Pure membership resolver (no I/O)
 */

import type { MembershipContext, ResolveMembershipInput } from './types';

/**
 * Resolve active membership for a user.
 * When useMembershipAuth is false, returns null (V1 path — no membership resolution).
 */
export function resolveMembership(input: ResolveMembershipInput): MembershipContext | null {
  if (!input.useMembershipAuth) {
    return null;
  }

  const active = input.memberships.filter(
    (m) => m.userId === input.userId && m.status === 'active'
  );

  if (active.length === 0) {
    return null;
  }

  const sorted = [...active].sort((a, b) => {
    if (a.isPrimary !== b.isPrimary) {
      return a.isPrimary ? -1 : 1;
    }
    return a.id.localeCompare(b.id);
  });

  const selected = sorted[0];

  return {
    membershipId: selected.id,
    shopId: selected.shopId,
    userId: selected.userId,
    roleSlug: selected.roleSlug,
    isPrimary: selected.isPrimary,
    status: selected.status,
    source: 'membership',
  };
}
