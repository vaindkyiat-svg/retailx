/**
 * RetailX V2 Milestone D1.4A — Release gate engine tests
 */

import { describe, it, expect } from 'vitest';
import { DEFAULT_RELEASE_GATE_CONFIG } from './ReleaseGate';
import { evaluateAllGates, evaluateGate, resolveDecisionFromGates } from './release-gate-engine';
import type { ReleaseMetricsSnapshot } from './ReleaseMetrics';

const healthyMetrics = (): ReleaseMetricsSnapshot => ({
  shadowMatchPercent: 95,
  shadowMismatchPercent: 5,
  loginSuccessPercent: 98,
  loginFailureCount: 1,
  sessionErrors: 0,
  permissionErrors: 0,
  authErrors: 1,
  averageLoginTimeMs: 200,
  maxLoginTimeMs: 800,
  healthScore: 95,
  databaseHealthOk: true,
  architectureValidationPassed: true,
  activePilotShops: [],
  shadowTotalLogins: 100,
  pilotTotalLogins: 50,
});

describe('release-gate-engine', () => {
  it('passes all gates for healthy metrics', () => {
    const gates = evaluateAllGates(DEFAULT_RELEASE_GATE_CONFIG, healthyMetrics());
    expect(gates.every((g) => g.passed)).toBe(true);

    const { decision } = resolveDecisionFromGates(gates, DEFAULT_RELEASE_GATE_CONFIG, {
      emergencyOverrideActive: false,
      pilotActive: false,
      insufficientData: false,
    });
    expect(decision).toBe('GO');
  });

  it('returns BLOCK when blocking gate fails', () => {
    const metrics = { ...healthyMetrics(), architectureValidationPassed: false };
    const gates = evaluateAllGates(DEFAULT_RELEASE_GATE_CONFIG, metrics);
    const { decision, reasons } = resolveDecisionFromGates(gates, DEFAULT_RELEASE_GATE_CONFIG, {
      emergencyOverrideActive: false,
      pilotActive: false,
      insufficientData: false,
    });
    expect(decision).toBe('BLOCK');
    expect(reasons.length).toBeGreaterThan(0);
  });

  it('returns ROLLBACK when pilot active and mismatch threshold crossed', () => {
    const metrics = { ...healthyMetrics(), shadowMismatchPercent: 25 };
    const gates = evaluateAllGates(DEFAULT_RELEASE_GATE_CONFIG, metrics);
    const { decision, reasons } = resolveDecisionFromGates(gates, DEFAULT_RELEASE_GATE_CONFIG, {
      emergencyOverrideActive: false,
      pilotActive: true,
      insufficientData: false,
    });
    expect(decision).toBe('ROLLBACK');
    expect(reasons.some((r) => r.includes('Mismatch'))).toBe(true);
  });

  it('returns HOLD for non-blocking gate failure without active pilot', () => {
    const metrics = { ...healthyMetrics(), shadowMatchPercent: 50 };
    const gates = evaluateAllGates(DEFAULT_RELEASE_GATE_CONFIG, metrics);
    const { decision } = resolveDecisionFromGates(gates, DEFAULT_RELEASE_GATE_CONFIG, {
      emergencyOverrideActive: false,
      pilotActive: false,
      insufficientData: false,
    });
    expect(decision).toBe('HOLD');
  });

  it('returns BLOCK on emergency override', () => {
    const gates = evaluateAllGates(DEFAULT_RELEASE_GATE_CONFIG, healthyMetrics());
    const { decision } = resolveDecisionFromGates(gates, DEFAULT_RELEASE_GATE_CONFIG, {
      emergencyOverrideActive: true,
      pilotActive: false,
      insufficientData: false,
    });
    expect(decision).toBe('BLOCK');
  });

  it('evaluates individual gate with min operator', () => {
    const gate = DEFAULT_RELEASE_GATE_CONFIG.gates.find((g) => g.id === 'shadow_match_percent')!;
    const result = evaluateGate(gate, { ...healthyMetrics(), shadowMatchPercent: 85 });
    expect(result.passed).toBe(false);
  });
});
