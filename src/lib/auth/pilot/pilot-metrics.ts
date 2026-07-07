/**
 * RetailX V2 Milestone D1.4 — Pilot shop monitoring metrics
 */

import type { AuthPathSource } from './types';
import type { ComparisonOutcome } from '../shadow/ComparisonResult';

export interface PilotMetricsSnapshot {
  loginSuccess: number;
  loginFailure: number;
  shadowMatches: number;
  shadowMismatches: number;
  shadowMismatchRate: number;
  averageLoginTimeMs: number;
  maxLoginTimeMs: number;
  sessionErrors: number;
  permissionErrors: number;
  activePilotShops: string[];
  currentUserIds: string[];
  rollbackReady: boolean;
  emergencyForceV1: boolean;
}

export class PilotMetrics {
  private loginSuccess = 0;
  private loginFailure = 0;
  private shadowMatches = 0;
  private shadowMismatches = 0;
  private totalLoginTimeMs = 0;
  private maxLoginTimeMs = 0;
  private sessionErrors = 0;
  private permissionErrors = 0;
  private activePilotShops = new Set<string>();
  private currentUserIds = new Set<string>();
  private emergencyForceV1 = false;

  recordLoginSuccess(
    shopId: string | undefined,
    userId: string,
    durationMs: number,
    source: AuthPathSource
  ): void {
    this.loginSuccess++;
    this.totalLoginTimeMs += durationMs;
    this.maxLoginTimeMs = Math.max(this.maxLoginTimeMs, durationMs);
    this.currentUserIds.add(userId);
    if (source === 'pilot' && shopId) {
      this.activePilotShops.add(shopId);
    }
  }

  recordLoginFailure(shopId: string | undefined, durationMs: number): void {
    this.loginFailure++;
    this.totalLoginTimeMs += durationMs;
    this.maxLoginTimeMs = Math.max(this.maxLoginTimeMs, durationMs);
    if (shopId) {
      // keep shop context for failure tracking
    }
  }

  recordShadowOutcome(outcome: ComparisonOutcome, shopId: string | null, isPilot: boolean): void {
    if (!isPilot) return;
    if (outcome === 'MATCH') {
      this.shadowMatches++;
    } else {
      this.shadowMismatches++;
    }
    if (shopId) this.activePilotShops.add(shopId);
  }

  recordSessionError(): void {
    this.sessionErrors++;
  }

  recordPermissionError(): void {
    this.permissionErrors++;
  }

  setEmergencyForceV1(active: boolean): void {
    this.emergencyForceV1 = active;
  }

  setActivePilotShops(shopIds: string[]): void {
    this.activePilotShops = new Set(shopIds);
  }

  clearCurrentUsers(): void {
    this.currentUserIds.clear();
  }

  getSnapshot(): PilotMetricsSnapshot {
    const totalLogins = this.loginSuccess + this.loginFailure;
    const shadowTotal = this.shadowMatches + this.shadowMismatches;
    const shadowMismatchRate =
      shadowTotal > 0 ? round((this.shadowMismatches / shadowTotal) * 100) : 0;
    const averageLoginTimeMs =
      totalLogins > 0 ? round(this.totalLoginTimeMs / totalLogins) : 0;

    return {
      loginSuccess: this.loginSuccess,
      loginFailure: this.loginFailure,
      shadowMatches: this.shadowMatches,
      shadowMismatches: this.shadowMismatches,
      shadowMismatchRate,
      averageLoginTimeMs,
      maxLoginTimeMs: this.maxLoginTimeMs,
      sessionErrors: this.sessionErrors,
      permissionErrors: this.permissionErrors,
      activePilotShops: [...this.activePilotShops],
      currentUserIds: [...this.currentUserIds],
      rollbackReady: this.activePilotShops.size === 0 || this.emergencyForceV1,
      emergencyForceV1: this.emergencyForceV1,
    };
  }

  reset(): void {
    this.loginSuccess = 0;
    this.loginFailure = 0;
    this.shadowMatches = 0;
    this.shadowMismatches = 0;
    this.totalLoginTimeMs = 0;
    this.maxLoginTimeMs = 0;
    this.sessionErrors = 0;
    this.permissionErrors = 0;
    this.activePilotShops.clear();
    this.currentUserIds.clear();
    this.emergencyForceV1 = false;
  }
}

export const pilotMetrics = new PilotMetrics();

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
