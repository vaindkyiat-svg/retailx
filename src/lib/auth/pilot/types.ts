/**
 * RetailX V2 Milestone D1.4 — Pilot shop types
 */

export type AuthPathSource = 'emergency' | 'pilot' | 'global' | 'legacy';

export interface AuthPathResolution {
  useMembershipAuth: boolean;
  source: AuthPathSource;
  shopId?: string;
  pilotEnabled?: boolean;
  emergencyForceV1?: boolean;
}

export interface PilotShopRecord {
  id: string;
  shopId: string;
  enabled: boolean;
  enabledBy: string | null;
  enabledAt: string | null;
  notes: string | null;
}
