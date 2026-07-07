/**
 * RetailX V2 Milestone D1.4A — RolloutController tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RolloutController } from './RolloutController';
import { shadowMetrics } from '../shadow/shadow-metrics';
import { pilotMetrics } from '../pilot/pilot-metrics';
import { authIncidentEngine } from './auth-incident-engine';
import { releaseHistoryStore } from './release-history';
import { mergeGateConfig } from './ReleaseGate';

vi.mock('../pilot/pilot-shop-client', () => ({
  getEnabledPilotShops: vi.fn().mockResolvedValue([]),
  getAllPilotShopRecords: vi.fn().mockResolvedValue([]),
}));

import { getEnabledPilotShops } from '../pilot/pilot-shop-client';

function seedHealthyMetrics(): void {
  for (let i = 0; i < 20; i++) {
    shadowMetrics.recordValidation('MATCH', 5, [], 'shop-1');
    pilotMetrics.recordLoginSuccess('shop-1', `u${i}`, 100, 'legacy');
  }
}

function seedUnhealthyMismatch(): void {
  for (let i = 0; i < 20; i++) {
    shadowMetrics.recordValidation(i < 5 ? 'MATCH' : 'MISMATCH', 5, ['WRONG_SHOP'], 'shop-1');
    pilotMetrics.recordLoginSuccess('shop-1', `u${i}`, 100, 'pilot');
  }
}

describe('RolloutController', () => {
  const originalEmergency = process.env.RETAILX_EMERGENCY_FORCE_V1;

  afterEach(() => {
    if (originalEmergency === undefined) {
      delete process.env.RETAILX_EMERGENCY_FORCE_V1;
    } else {
      process.env.RETAILX_EMERGENCY_FORCE_V1 = originalEmergency;
    }
  });

  beforeEach(() => {
    shadowMetrics.reset();
    pilotMetrics.reset();
    authIncidentEngine.clear();
    releaseHistoryStore.clear();
    vi.mocked(getEnabledPilotShops).mockResolvedValue([]);
    delete process.env.RETAILX_EMERGENCY_FORCE_V1;
  });

  it('returns GO when all gates pass with sufficient data', async () => {
    seedHealthyMetrics();
    const controller = new RolloutController();
    controller.setMinimumSampleSize(10);

    const decision = await controller.evaluate({
      shopId: 'shop-1',
      metricsInput: {
        healthScore: 95,
        databaseHealthOk: true,
        architectureValidationPassed: true,
      },
    });

    expect(decision.decision).toBe('GO');
    expect(decision.reasons).toContain('All release gates passed');
  });

  it('returns HOLD when insufficient data', async () => {
    const controller = new RolloutController();
    controller.setMinimumSampleSize(100);

    const decision = await controller.evaluate({
      metricsInput: {
        healthScore: 95,
        databaseHealthOk: true,
        architectureValidationPassed: true,
      },
    });

    expect(decision.decision).toBe('HOLD');
  });

  it('returns BLOCK on emergency override', async () => {
    process.env.RETAILX_EMERGENCY_FORCE_V1 = 'true';
    seedHealthyMetrics();

    const controller = new RolloutController();
    controller.setMinimumSampleSize(5);

    const decision = await controller.evaluate({ shopId: 'shop-1' });
    expect(decision.decision).toBe('BLOCK');
    expect(decision.emergencyOverrideActive).toBe(true);
  });

  it('returns ROLLBACK and triggers handler when pilot active and mismatch high', async () => {
    seedUnhealthyMismatch();
    vi.mocked(getEnabledPilotShops).mockResolvedValue([
      {
        id: 'p1',
        shopId: 'shop-1',
        enabled: true,
        enabledBy: 'ops',
        enabledAt: null,
        notes: null,
      },
    ]);

    const rollbackFn = vi.fn().mockResolvedValue({
      shopId: 'shop-1',
      success: true,
      reason: 'test',
      command: 'disable',
    });

    const controller = new RolloutController();
    controller.setMinimumSampleSize(5);
    controller.setRollbackHandler({ rollbackPilot: rollbackFn });

    const decision = await controller.evaluate({ shopId: 'shop-1' });

    expect(decision.decision).toBe('ROLLBACK');
    expect(decision.automaticRollbackTriggered).toBe(true);
    expect(rollbackFn).toHaveBeenCalled();
    expect(authIncidentEngine.getOpenIncidents().length).toBeGreaterThan(0);
  });

  it('records release history on every evaluation', async () => {
    seedHealthyMetrics();
    const controller = new RolloutController();
    controller.setMinimumSampleSize(5);

    await controller.evaluate({ shopId: 'shop-1', approvedBy: 'test@ops' });
    expect(releaseHistoryStore.getAll()).toHaveLength(1);
    expect(releaseHistoryStore.getAll()[0].approvedBy).toBe('test@ops');
  });

  it('uses configurable gate thresholds', async () => {
    seedHealthyMetrics();
    const controller = new RolloutController(
      mergeGateConfig({
        gates: [
          {
            id: 'shadow_match_percent',
            label: 'Shadow Match %',
            enabled: true,
            operator: 'min',
            threshold: 100.01,
            blocking: false,
            rollbackTrigger: false,
          },
        ],
      })
    );
    controller.setMinimumSampleSize(5);

    const decision = await controller.evaluate({ shopId: 'shop-1' });
    expect(decision.decision).toBe('HOLD');
  });

  it('handles concurrent rollout evaluations', async () => {
    seedHealthyMetrics();
    const controller = new RolloutController();
    controller.setMinimumSampleSize(5);

    const results = await Promise.all([
      controller.evaluate({ shopId: 'shop-1' }),
      controller.evaluate({ shopId: 'shop-1' }),
      controller.evaluate({ shopId: 'shop-1' }),
    ]);

    expect(results.every((r) => r.decision === 'GO')).toBe(true);
    expect(releaseHistoryStore.getAll().length).toBe(3);
  });
});
