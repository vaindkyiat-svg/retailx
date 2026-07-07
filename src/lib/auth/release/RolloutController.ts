/**
 * RetailX V2 Milestone D1.4A — Rollout controller
 *
 * Decides IF rollout is allowed. Does NOT enable pilot or change login behavior.
 */

import { logAuthEvent } from '../auth-logger';
import { getEmergencyForceV1 } from '../pilot/resolve-auth-path';
import { getEnabledPilotShops } from '../pilot/pilot-shop-client';
import type { PilotShopRecord } from '../pilot/types';
import {
  authIncidentEngine,
  categoryForGate,
  severityForDecision,
} from './auth-incident-engine';
import type { ReleaseDecision, ReleasePhase } from './ReleaseDecision';
import {
  DEFAULT_RELEASE_GATE_CONFIG,
  mergeGateConfig,
  type ReleaseGateConfig,
} from './ReleaseGate';
import { evaluateAllGates, resolveDecisionFromGates } from './release-gate-engine';
import { collectReleaseMetrics, type ReleaseMetricsInput } from './ReleaseMetrics';
import { recordReleaseDecision } from './release-history';

export interface RolloutEvaluateOptions {
  shopId?: string | null;
  approvedBy?: string | null;
  metricsInput?: ReleaseMetricsInput;
  gateConfig?: ReleaseGateConfig;
  /** Minimum shadow+pilot samples before GO is allowed */
  minimumSampleSize?: number;
  correlationId?: string;
}

export interface PilotRollbackResult {
  shopId: string;
  success: boolean;
  reason: string;
  command: string;
}

export interface PilotRollbackHandler {
  rollbackPilot(shopId: string, reason: string): Promise<PilotRollbackResult>;
}

/** Records rollback intent — actual DB disable requires ops CLI or injected handler */
export const defaultPilotRollbackHandler: PilotRollbackHandler = {
  async rollbackPilot(shopId, reason) {
    logAuthEvent('warn', 'Pilot rollback requested (manual CLI required)', {
      shopId,
      reason,
      command: `npm run db:pilot -- disable ${shopId}`,
    });
    return {
      shopId,
      success: false,
      reason,
      command: `npm run db:pilot -- disable ${shopId}`,
    };
  },
};

export class RolloutController {
  private rollbackHandler: PilotRollbackHandler = defaultPilotRollbackHandler;
  private gateConfig: ReleaseGateConfig = DEFAULT_RELEASE_GATE_CONFIG;
  private minimumSampleSize = 10;
  private lastDecision: ReleaseDecision | null = null;

  constructor(config?: Partial<ReleaseGateConfig>) {
    if (config) {
      this.gateConfig = mergeGateConfig(config);
    }
  }

  setGateConfig(config: ReleaseGateConfig): void {
    this.gateConfig = config;
  }

  setMinimumSampleSize(size: number): void {
    this.minimumSampleSize = size;
  }

  setRollbackHandler(handler: PilotRollbackHandler): void {
    this.rollbackHandler = handler;
  }

  getLastDecision(): ReleaseDecision | null {
    return this.lastDecision;
  }

  /**
   * Evaluate whether rollout is allowed. Does NOT enable pilot.
   */
  async evaluate(options: RolloutEvaluateOptions = {}): Promise<ReleaseDecision> {
    const startedAt = performance.now();
    const correlationId =
      options.correlationId ??
      `release-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const gateConfig = options.gateConfig ?? this.gateConfig;
    const metrics = collectReleaseMetrics(options.metricsInput ?? {});
    const emergencyOverrideActive = getEmergencyForceV1();

    let pilotShops: PilotShopRecord[] = [];
    try {
      pilotShops = await getEnabledPilotShops();
    } catch {
      pilotShops = [];
    }

    const targetShopId = options.shopId ?? pilotShops[0]?.shopId ?? null;
    const pilotActive =
      pilotShops.some((p) => p.enabled) &&
      (targetShopId ? pilotShops.some((p) => p.shopId === targetShopId && p.enabled) : true);

    const phase = resolvePhase(pilotActive, targetShopId);
    const insufficientData =
      metrics.shadowTotalLogins < this.minimumSampleSize &&
      metrics.pilotTotalLogins < this.minimumSampleSize;

    const gates = evaluateAllGates(gateConfig, metrics);
    const { decision, reasons } = resolveDecisionFromGates(gates, gateConfig, {
      emergencyOverrideActive,
      pilotActive,
      insufficientData,
    });

    let automaticRollbackTriggered = false;

    const releaseDecision: ReleaseDecision = {
      decision,
      phase,
      shopId: targetShopId,
      version: gateConfig.version,
      reasons,
      gates,
      evaluatedAt: new Date().toISOString(),
      correlationId,
      metricsSnapshot: { ...metrics },
      automaticRollbackTriggered,
      emergencyOverrideActive,
    };

    if (decision === 'ROLLBACK' && targetShopId) {
      automaticRollbackTriggered = await this.executePilotRollback(
        targetShopId,
        reasons.join('; '),
        correlationId,
        metrics
      );
      releaseDecision.automaticRollbackTriggered = automaticRollbackTriggered;
    }

    if (decision === 'ROLLBACK' || decision === 'BLOCK') {
      this.recordIncidents(releaseDecision);
    }

    recordReleaseDecision({
      version: gateConfig.version,
      shopId: targetShopId,
      decision,
      metricsSnapshot: releaseDecision.metricsSnapshot,
      approvedBy: options.approvedBy ?? null,
      rollback: decision === 'ROLLBACK',
      durationMs: Math.round(performance.now() - startedAt),
      reasons,
    });

    this.lastDecision = releaseDecision;

    logAuthEvent('info', 'Release evaluation complete', {
      decision,
      phase,
      shopId: targetShopId,
      correlationId,
      automaticRollbackTriggered,
    });

    return releaseDecision;
  }

  private async executePilotRollback(
    shopId: string,
    reason: string,
    correlationId: string,
    metrics: Record<string, unknown>
  ): Promise<boolean> {
    authIncidentEngine.createIncident({
      severity: 'high',
      category: 'MISMATCH_THRESHOLD',
      shopId,
      reason: `Automatic pilot rollback: ${reason}`,
      metrics,
      correlationId,
    });

    const result = await this.rollbackHandler.rollbackPilot(shopId, reason);

    logAuthEvent('warn', 'Pilot rollback executed', {
      shopId,
      success: result.success,
      command: result.command,
      correlationId,
    });

    return result.success;
  }

  private recordIncidents(decision: ReleaseDecision): void {
    const failedGates = decision.gates.filter((g) => !g.passed);
    const severity = severityForDecision(
      decision.decision === 'ROLLBACK' ? 'ROLLBACK' : 'BLOCK'
    );

    for (const gate of failedGates) {
      authIncidentEngine.createIncident({
        severity,
        category: categoryForGate(gate.gateId),
        shopId: decision.shopId,
        reason: gate.reason ?? `${gate.label} failed`,
        metrics: decision.metricsSnapshot,
        correlationId: decision.correlationId,
      });
    }

    if (failedGates.length === 0) {
      authIncidentEngine.createIncident({
        severity,
        category: decision.decision === 'ROLLBACK' ? 'MISMATCH_THRESHOLD' : 'ARCHITECTURE',
        shopId: decision.shopId,
        reason: decision.reasons.join('; '),
        metrics: decision.metricsSnapshot,
        correlationId: decision.correlationId,
      });
    }
  }
}

export const rolloutController = new RolloutController();

function resolvePhase(pilotActive: boolean, shopId: string | null): ReleasePhase {
  if (!pilotActive && !shopId) return 'pre_rollout';
  if (pilotActive) return 'pilot_active';
  if (shopId) return 'monitoring';
  return 'pre_rollout';
}
