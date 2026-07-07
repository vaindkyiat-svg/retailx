/**
 * RetailX V2 Milestone D1.4A — Release metrics aggregation
 */

import { shadowMetrics } from '../shadow/shadow-metrics';
import { pilotMetrics } from '../pilot/pilot-metrics';
import type { PilotShopRecord } from '../pilot/types';

export interface ReleaseMetricsInput {
  healthScore?: number;
  databaseHealthOk?: boolean;
  architectureValidationPassed?: boolean;
}

export interface ReleaseMetricsSnapshot {
  shadowMatchPercent: number;
  shadowMismatchPercent: number;
  loginSuccessPercent: number;
  loginFailureCount: number;
  sessionErrors: number;
  permissionErrors: number;
  authErrors: number;
  averageLoginTimeMs: number;
  maxLoginTimeMs: number;
  healthScore: number;
  databaseHealthOk: boolean;
  architectureValidationPassed: boolean;
  activePilotShops: string[];
  shadowTotalLogins: number;
  pilotTotalLogins: number;
}

export function collectReleaseMetrics(
  input: ReleaseMetricsInput = {}
): ReleaseMetricsSnapshot {
  const shadow = shadowMetrics.getSnapshot();
  const pilot = pilotMetrics.getSnapshot();

  const shadowTotal = shadow.totalLogins;
  const shadowMatchPercent =
    shadowTotal > 0 ? round((shadow.successfulMatches / shadowTotal) * 100) : 100;

  const pilotTotal = pilot.loginSuccess + pilot.loginFailure;
  const loginSuccessPercent =
    pilotTotal > 0 ? round((pilot.loginSuccess / pilotTotal) * 100) : 100;

  return {
    shadowMatchPercent,
    shadowMismatchPercent: shadow.mismatchRate,
    loginSuccessPercent,
    loginFailureCount: pilot.loginFailure,
    sessionErrors: pilot.sessionErrors,
    permissionErrors: pilot.permissionErrors,
    authErrors: pilot.loginFailure,
    averageLoginTimeMs: pilot.averageLoginTimeMs,
    maxLoginTimeMs: pilot.maxLoginTimeMs,
    healthScore: input.healthScore ?? 100,
    databaseHealthOk: input.databaseHealthOk ?? true,
    architectureValidationPassed: input.architectureValidationPassed ?? true,
    activePilotShops: pilot.activePilotShops,
    shadowTotalLogins: shadowTotal,
    pilotTotalLogins: pilotTotal,
  };
}

export function metricsForShop(
  shopId: string,
  pilotShops: PilotShopRecord[]
): { isPilotActive: boolean; shopId: string } {
  const record = pilotShops.find((p) => p.shopId === shopId);
  return { isPilotActive: record?.enabled ?? false, shopId };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
