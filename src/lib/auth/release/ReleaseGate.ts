/**
 * RetailX V2 Milestone D1.4A — Configurable release gate definitions
 *
 * All thresholds are configurable — no hardcoded values in the decision engine.
 */

export type GateOperator = 'min' | 'max' | 'eq';

export interface GateDefinition {
  id: string;
  label: string;
  enabled: boolean;
  operator: GateOperator;
  /** Numeric threshold or boolean expected value */
  threshold: number | boolean;
  /** When true, failure blocks rollout entirely */
  blocking: boolean;
  /** When true, failure on active pilot triggers ROLLBACK instead of HOLD */
  rollbackTrigger: boolean;
}

export interface ReleaseGateConfig {
  version: string;
  gates: GateDefinition[];
}

export const DEFAULT_RELEASE_GATE_CONFIG: ReleaseGateConfig = {
  version: 'D1.4A',
  gates: [
    {
      id: 'shadow_match_percent',
      label: 'Shadow Match %',
      enabled: true,
      operator: 'min',
      threshold: 90,
      blocking: false,
      rollbackTrigger: false,
    },
    {
      id: 'minimum_login_success_percent',
      label: 'Minimum Login Success %',
      enabled: true,
      operator: 'min',
      threshold: 95,
      blocking: true,
      rollbackTrigger: false,
    },
    {
      id: 'maximum_mismatch_percent',
      label: 'Maximum Mismatch %',
      enabled: true,
      operator: 'max',
      threshold: 10,
      blocking: false,
      rollbackTrigger: true,
    },
    {
      id: 'maximum_session_errors',
      label: 'Maximum Session Errors',
      enabled: true,
      operator: 'max',
      threshold: 5,
      blocking: false,
      rollbackTrigger: true,
    },
    {
      id: 'maximum_permission_errors',
      label: 'Maximum Permission Errors',
      enabled: true,
      operator: 'max',
      threshold: 3,
      blocking: false,
      rollbackTrigger: true,
    },
    {
      id: 'maximum_auth_errors',
      label: 'Maximum Auth Errors',
      enabled: true,
      operator: 'max',
      threshold: 10,
      blocking: true,
      rollbackTrigger: true,
    },
    {
      id: 'maximum_login_time_ms',
      label: 'Maximum Login Time (ms)',
      enabled: true,
      operator: 'max',
      threshold: 3000,
      blocking: false,
      rollbackTrigger: false,
    },
    {
      id: 'minimum_health_score',
      label: 'Minimum Health Score',
      enabled: true,
      operator: 'min',
      threshold: 80,
      blocking: true,
      rollbackTrigger: false,
    },
    {
      id: 'database_health',
      label: 'Database Health',
      enabled: true,
      operator: 'eq',
      threshold: true,
      blocking: true,
      rollbackTrigger: false,
    },
    {
      id: 'architecture_validation',
      label: 'Architecture Validation',
      enabled: true,
      operator: 'eq',
      threshold: true,
      blocking: true,
      rollbackTrigger: false,
    },
  ],
};

export function mergeGateConfig(
  overrides: Partial<ReleaseGateConfig> & { gates?: GateDefinition[] }
): ReleaseGateConfig {
  if (overrides.gates) {
    return { version: overrides.version ?? DEFAULT_RELEASE_GATE_CONFIG.version, gates: overrides.gates };
  }
  return { ...DEFAULT_RELEASE_GATE_CONFIG, ...overrides };
}
