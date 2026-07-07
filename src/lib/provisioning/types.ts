/**
 * RetailX V2 Sprint E1 — Shop provisioning types
 */

export interface ProvisionShopInput {
  shopName: string;
  ownerName: string;
  ownerEmail: string;
  phone: string;
  address?: string;
  city?: string;
  state?: string;
  gst?: string;
  category?: string;
  plan?: string;
  timezone?: string;
  currency?: string;
  /** Legacy V1 username (optional — auto-generated if omitted) */
  username?: string;
  /** Temporary password for owner login */
  temporaryPassword?: string;
  useInvitation?: boolean;
  idempotencyKey?: string;
  provisionedBy?: string;
}

export interface ProvisionShopResult {
  shopId: string;
  ownerUserId: string;
  membershipId: string;
  branchId: string;
  warehouseId: string;
  subscriptionId: string;
  invitationId?: string | null;
  temporaryPassword?: string;
  invitationSent: boolean;
  idempotencyKey: string;
  planCode: string;
  username?: string;
}

export interface BusinessValidationResult {
  valid: boolean;
  checks: Array<{ name: string; passed: boolean; detail?: string }>;
}

export interface ProvisionLogEntry {
  step: string;
  status: string;
  detail?: Record<string, unknown>;
  timestamp: string;
}
