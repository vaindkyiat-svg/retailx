/**
 * RetailX V2 Milestone D1.3 — Identity comparison engine (pure)
 */

import type { IdentityContext } from '../identity/types';
import type { AuthSession } from '../types';
import type {
  ComparisonResult,
  FieldMismatch,
  IdentitySnapshot,
  MismatchCategory,
} from './ComparisonResult';

export function snapshotFromIdentity(
  identity: IdentityContext | null,
  session: AuthSession | null,
  branchCode: string | null = null
): IdentitySnapshot | null {
  if (!identity?.user) return null;

  return {
    userId: identity.user.id,
    email: identity.user.email,
    shopId: identity.user.shop_id ?? null,
    membershipId: identity.membership?.membershipId ?? null,
    role: identity.user.role,
    tenantShopId: identity.tenant?.shopId ?? null,
    branchCode,
    permissions: identity.permissions?.permissions ?? [],
    sessionUserId: session?.userId ?? null,
    sessionActive: session !== null,
  };
}

export function compareIdentitySnapshots(
  v1: IdentitySnapshot | null,
  v2: IdentitySnapshot | null,
  meta: { correlationId: string; durationMs: number }
): ComparisonResult {
  const mismatches: FieldMismatch[] = [];

  if (!v1 && !v2) {
    return buildResult('MISMATCH', null, null, null, mismatches, meta, ['ORPHAN_USER']);
  }

  if (!v1 || !v2) {
    mismatches.push({
      field: 'identity',
      v1Value: v1?.userId ?? null,
      v2Value: v2?.userId ?? null,
      category: 'ORPHAN_USER',
    });
    return buildResult(
      'MISMATCH',
      v1?.userId ?? v2?.userId ?? 'unknown',
      v1?.shopId ?? v2?.shopId ?? null,
      v1?.email ?? v2?.email ?? null,
      mismatches,
      meta,
      ['ORPHAN_USER']
    );
  }

  compareField(mismatches, 'userId', v1.userId, v2.userId, 'ORPHAN_USER');
  compareField(mismatches, 'email', v1.email, v2.email, 'ORPHAN_USER');
  compareField(mismatches, 'shopId', v1.shopId, v2.shopId, 'WRONG_SHOP');
  compareField(mismatches, 'role', v1.role, v2.role, 'WRONG_ROLE');
  compareField(mismatches, 'tenantShopId', v1.tenantShopId, v2.tenantShopId, 'INVALID_TENANT');

  if (!v2.membershipId && v1.shopId) {
    mismatches.push({
      field: 'membershipId',
      v1Value: null,
      v2Value: null,
      category: 'MISSING_MEMBERSHIP',
    });
  }

  if (v1.branchCode !== null || v2.branchCode !== null) {
    compareField(mismatches, 'branchCode', v1.branchCode, v2.branchCode, 'WRONG_BRANCH');
  }

  comparePermissions(mismatches, v1.permissions, v2.permissions);

  if (v2.sessionUserId && v1.sessionUserId !== v2.sessionUserId) {
    mismatches.push({
      field: 'sessionUserId',
      v1Value: v1.sessionUserId,
      v2Value: v2.sessionUserId,
      category: 'UNKNOWN',
    });
  }

  const categories = [...new Set(mismatches.map((m) => m.category))];
  const outcome = mismatches.length === 0 ? 'MATCH' : 'MISMATCH';

  return buildResult(outcome, v1.userId, v1.shopId, v1.email, mismatches, meta, categories);
}

export function compareIdentityContexts(
  v1Context: IdentityContext | null,
  v2Context: IdentityContext | null,
  session: AuthSession | null,
  branchCodes: { v1: string | null; v2: string | null },
  meta: { correlationId: string; durationMs: number }
): ComparisonResult {
  const v1 = snapshotFromIdentity(v1Context, session, branchCodes.v1);
  const v2 = snapshotFromIdentity(v2Context, session, branchCodes.v2);
  return compareIdentitySnapshots(v1, v2, meta);
}

function compareField(
  mismatches: FieldMismatch[],
  field: string,
  v1Value: string | null,
  v2Value: string | null,
  category: MismatchCategory
): void {
  if (normalize(v1Value) !== normalize(v2Value)) {
    mismatches.push({ field, v1Value, v2Value, category });
  }
}

function comparePermissions(
  mismatches: FieldMismatch[],
  v1Perms: string[],
  v2Perms: string[]
): void {
  const a = [...v1Perms].sort().join(',');
  const b = [...v2Perms].sort().join(',');
  if (a !== b && (v1Perms.length > 0 || v2Perms.length > 0)) {
    mismatches.push({
      field: 'permissions',
      v1Value: a || null,
      v2Value: b || null,
      category: 'WRONG_PERMISSION',
    });
  }
}

function normalize(value: string | null): string | null {
  if (value === null || value === undefined || value === '') return null;
  return value;
}

function buildResult(
  outcome: ComparisonResult['outcome'],
  userId: string | null,
  shopId: string | null,
  email: string | null,
  mismatches: FieldMismatch[],
  meta: { correlationId: string; durationMs: number },
  categories: MismatchCategory[]
): ComparisonResult {
  return {
    outcome,
    correlationId: meta.correlationId,
    userId: userId ?? 'unknown',
    shopId,
    email,
    durationMs: meta.durationMs,
    mismatches,
    categories: categories.length > 0 ? categories : outcome === 'MATCH' ? [] : ['UNKNOWN'],
    v1Authoritative: true,
    shadowDiscarded: true,
    comparedAt: new Date().toISOString(),
  };
}
