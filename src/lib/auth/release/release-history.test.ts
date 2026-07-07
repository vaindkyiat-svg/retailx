/**
 * RetailX V2 Milestone D1.4A — Incident and history tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { authIncidentEngine } from './auth-incident-engine';
import { releaseHistoryStore, recordReleaseDecision } from './release-history';

describe('AuthIncidentEngine', () => {
  beforeEach(() => {
    authIncidentEngine.clear();
  });

  it('creates and resolves incidents', () => {
    const incident = authIncidentEngine.createIncident({
      severity: 'high',
      category: 'MISMATCH_THRESHOLD',
      shopId: 'shop-1',
      reason: 'Mismatch exceeded',
      metrics: { rate: 15 },
    });

    expect(incident.resolved).toBe(false);
    expect(authIncidentEngine.getOpenIncidents()).toHaveLength(1);

    authIncidentEngine.resolveIncident(incident.id);
    expect(authIncidentEngine.getOpenIncidents()).toHaveLength(0);
  });
});

describe('ReleaseHistoryStore', () => {
  beforeEach(() => {
    releaseHistoryStore.clear();
  });

  it('records release decisions', () => {
    const entry = recordReleaseDecision({
      version: 'D1.4A',
      shopId: 'shop-1',
      decision: 'GO',
      metricsSnapshot: { shadowMatchPercent: 95 },
      approvedBy: 'ops',
      reasons: ['All gates passed'],
    });

    expect(entry.decision).toBe('GO');
    expect(releaseHistoryStore.getRecent(5)).toHaveLength(1);
  });
});
