/**
 * RetailX V2 Milestone D1.4 — Pilot metrics tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { pilotMetrics } from './pilot-metrics';

describe('PilotMetrics', () => {
  beforeEach(() => {
    pilotMetrics.reset();
  });

  it('tracks login success and failure', () => {
    pilotMetrics.recordLoginSuccess('shop-1', 'u1', 120, 'pilot');
    pilotMetrics.recordLoginFailure('shop-1', 80);

    const snap = pilotMetrics.getSnapshot();
    expect(snap.loginSuccess).toBe(1);
    expect(snap.loginFailure).toBe(1);
    expect(snap.averageLoginTimeMs).toBe(100);
    expect(snap.activePilotShops).toContain('shop-1');
    expect(snap.currentUserIds).toContain('u1');
  });

  it('tracks shadow outcomes for pilot shops only', () => {
    pilotMetrics.recordShadowOutcome('MATCH', 'shop-1', true);
    pilotMetrics.recordShadowOutcome('MISMATCH', 'shop-1', true);
    pilotMetrics.recordShadowOutcome('MISMATCH', 'shop-2', false);

    const snap = pilotMetrics.getSnapshot();
    expect(snap.shadowMatches).toBe(1);
    expect(snap.shadowMismatches).toBe(1);
    expect(snap.shadowMismatchRate).toBe(50);
  });

  it('marks rollback ready when no active pilots', () => {
    expect(pilotMetrics.getSnapshot().rollbackReady).toBe(true);
  });

  it('tracks session and permission errors', () => {
    pilotMetrics.recordSessionError();
    pilotMetrics.recordPermissionError();
    const snap = pilotMetrics.getSnapshot();
    expect(snap.sessionErrors).toBe(1);
    expect(snap.permissionErrors).toBe(1);
  });
});
