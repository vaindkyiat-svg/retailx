/**
 * RetailX V2 Milestone D1.3 — Shadow validation mismatch categories
 */

export type MismatchCategory =
  | 'MISSING_MEMBERSHIP'
  | 'WRONG_ROLE'
  | 'WRONG_SHOP'
  | 'WRONG_BRANCH'
  | 'WRONG_PERMISSION'
  | 'ORPHAN_USER'
  | 'INVALID_TENANT'
  | 'UNKNOWN';

export type ComparisonOutcome = 'MATCH' | 'MISMATCH';

export interface FieldMismatch {
  field: string;
  v1Value: string | null;
  v2Value: string | null;
  category: MismatchCategory;
}

export interface ComparisonResult {
  outcome: ComparisonOutcome;
  correlationId: string;
  userId: string;
  shopId: string | null;
  email: string | null;
  durationMs: number;
  mismatches: FieldMismatch[];
  categories: MismatchCategory[];
  v1Authoritative: true;
  shadowDiscarded: true;
  comparedAt: string;
}

export interface IdentitySnapshot {
  userId: string;
  email: string;
  shopId: string | null;
  membershipId: string | null;
  role: string;
  tenantShopId: string | null;
  branchCode: string | null;
  permissions: string[];
  sessionUserId: string | null;
  sessionActive: boolean;
}

export interface IdentityValidationLogEntry {
  id: string;
  correlationId: string;
  timestamp: string;
  userId: string;
  shopId: string | null;
  email: string | null;
  outcome: ComparisonOutcome;
  durationMs: number;
  mismatchCategories: MismatchCategory[];
  mismatchCount: number;
  trigger: 'sign_in' | 'session_restore';
}
