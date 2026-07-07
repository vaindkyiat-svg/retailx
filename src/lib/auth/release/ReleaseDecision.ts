/**
 * RetailX V2 Milestone D1.4A — Release decision types
 */

export type ReleaseDecisionType = 'GO' | 'HOLD' | 'ROLLBACK' | 'BLOCK';

export type ReleasePhase = 'pre_rollout' | 'pilot_active' | 'monitoring' | 'post_rollback';

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical';

export type IncidentCategory =
  | 'MISMATCH_THRESHOLD'
  | 'LOGIN_FAILURE'
  | 'SESSION_ERROR'
  | 'PERMISSION_ERROR'
  | 'PERFORMANCE'
  | 'HEALTH'
  | 'ARCHITECTURE'
  | 'MANUAL'
  | 'UNKNOWN';

export interface GateEvaluation {
  gateId: string;
  label: string;
  passed: boolean;
  actual: number | boolean | string;
  threshold: number | boolean | string;
  operator: 'min' | 'max' | 'eq';
  reason?: string;
}

export interface ReleaseDecision {
  decision: ReleaseDecisionType;
  phase: ReleasePhase;
  shopId: string | null;
  version: string;
  reasons: string[];
  gates: GateEvaluation[];
  evaluatedAt: string;
  correlationId: string;
  metricsSnapshot: Record<string, unknown>;
  automaticRollbackTriggered: boolean;
  emergencyOverrideActive: boolean;
}

export interface AuthIncident {
  id: string;
  severity: IncidentSeverity;
  category: IncidentCategory;
  shopId: string | null;
  timestamp: string;
  reason: string;
  metrics: Record<string, unknown>;
  resolved: boolean;
  correlationId?: string;
}

export interface ReleaseHistoryEntry {
  id: string;
  version: string;
  shopId: string | null;
  decision: ReleaseDecisionType;
  metricsSnapshot: Record<string, unknown>;
  approvedBy: string | null;
  rollback: boolean;
  durationMs: number | null;
  reasons: string[];
  createdAt: string;
}
