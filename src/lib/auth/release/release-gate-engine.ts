/**
 * RetailX V2 Milestone D1.4A — Gate evaluation engine (pure)
 */

import type { GateDefinition, ReleaseGateConfig } from './ReleaseGate';
import type { GateEvaluation } from './ReleaseDecision';
import type { ReleaseMetricsSnapshot } from './ReleaseMetrics';

type MetricValue = number | boolean;

const METRIC_GETTERS: Record<string, (m: ReleaseMetricsSnapshot) => MetricValue> = {
  shadow_match_percent: (m) => m.shadowMatchPercent,
  minimum_login_success_percent: (m) => m.loginSuccessPercent,
  maximum_mismatch_percent: (m) => m.shadowMismatchPercent,
  maximum_session_errors: (m) => m.sessionErrors,
  maximum_permission_errors: (m) => m.permissionErrors,
  maximum_auth_errors: (m) => m.authErrors,
  maximum_login_time_ms: (m) => m.maxLoginTimeMs,
  minimum_health_score: (m) => m.healthScore,
  database_health: (m) => m.databaseHealthOk,
  architecture_validation: (m) => m.architectureValidationPassed,
};

export function evaluateGate(
  gate: GateDefinition,
  metrics: ReleaseMetricsSnapshot
): GateEvaluation {
  const getter = METRIC_GETTERS[gate.id];
  const actual: MetricValue = getter ? getter(metrics) : 0;

  const passed = checkOperator(actual, gate.operator, gate.threshold);

  return {
    gateId: gate.id,
    label: gate.label,
    passed,
    actual,
    threshold: gate.threshold,
    operator: gate.operator,
    reason: passed
      ? undefined
      : `${gate.label}: actual ${formatValue(actual)} fails ${gate.operator} ${formatValue(gate.threshold)}`,
  };
}

export function evaluateAllGates(
  config: ReleaseGateConfig,
  metrics: ReleaseMetricsSnapshot
): GateEvaluation[] {
  return config.gates
    .filter((g) => g.enabled)
    .map((g) => evaluateGate(g, metrics));
}

export function resolveDecisionFromGates(
  gates: GateEvaluation[],
  gateConfig: ReleaseGateConfig,
  options: {
    emergencyOverrideActive: boolean;
    pilotActive: boolean;
    insufficientData: boolean;
  }
): { decision: 'GO' | 'HOLD' | 'ROLLBACK' | 'BLOCK'; reasons: string[] } {
  const reasons: string[] = [];

  if (options.emergencyOverrideActive) {
    return {
      decision: 'BLOCK',
      reasons: ['Emergency override RETAILX_EMERGENCY_FORCE_V1 is active — rollout blocked'],
    };
  }

  const configById = new Map(gateConfig.gates.map((g) => [g.id, g]));

  const failedBlocking = gates.filter((g) => {
    const def = configById.get(g.gateId);
    return !g.passed && def?.blocking;
  });

  if (failedBlocking.length > 0) {
    for (const g of failedBlocking) {
      if (g.reason) reasons.push(g.reason);
    }
    return { decision: 'BLOCK', reasons };
  }

  const failedRollback = gates.filter((g) => {
    const def = configById.get(g.gateId);
    return !g.passed && def?.rollbackTrigger;
  });

  if (options.pilotActive && failedRollback.length > 0) {
    for (const g of failedRollback) {
      if (g.reason) reasons.push(g.reason);
    }
    reasons.push('Automatic pilot rollback threshold crossed');
    return { decision: 'ROLLBACK', reasons };
  }

  const failedAny = gates.filter((g) => !g.passed);
  if (failedAny.length > 0) {
    for (const g of failedAny) {
      if (g.reason) reasons.push(g.reason);
    }
    if (options.insufficientData) {
      reasons.push('Insufficient login/shadow data for rollout decision');
    }
    return { decision: 'HOLD', reasons };
  }

  if (options.insufficientData) {
    return {
      decision: 'HOLD',
      reasons: ['Insufficient login/shadow data — minimum sample not met'],
    };
  }

  return { decision: 'GO', reasons: ['All release gates passed'] };
}

function checkOperator(
  actual: MetricValue,
  operator: GateDefinition['operator'],
  threshold: MetricValue
): boolean {
  if (typeof actual === 'boolean' || typeof threshold === 'boolean') {
    return operator === 'eq' ? actual === threshold : actual === threshold;
  }
  const a = actual as number;
  const t = threshold as number;
  switch (operator) {
    case 'min':
      return a >= t;
    case 'max':
      return a <= t;
    case 'eq':
      return a === t;
    default:
      return false;
  }
}

function formatValue(v: MetricValue): string {
  return typeof v === 'boolean' ? String(v) : String(v);
}
