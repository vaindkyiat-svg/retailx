/**
 * RetailX V2 Milestone D1.4A — Auth incident engine
 */

import type { AuthIncident, IncidentCategory, IncidentSeverity } from './ReleaseDecision';

let incidentCounter = 0;

export class AuthIncidentEngine {
  private incidents: AuthIncident[] = [];
  private readonly maxIncidents = 500;

  createIncident(input: {
    severity: IncidentSeverity;
    category: IncidentCategory;
    shopId: string | null;
    reason: string;
    metrics: Record<string, unknown>;
    correlationId?: string;
  }): AuthIncident {
    const incident: AuthIncident = {
      id: `inc-${Date.now()}-${++incidentCounter}`,
      severity: input.severity,
      category: input.category,
      shopId: input.shopId,
      timestamp: new Date().toISOString(),
      reason: input.reason,
      metrics: input.metrics,
      resolved: false,
      correlationId: input.correlationId,
    };

    this.incidents.push(incident);
    if (this.incidents.length > this.maxIncidents) {
      this.incidents.shift();
    }

    return incident;
  }

  resolveIncident(id: string): boolean {
    const incident = this.incidents.find((i) => i.id === id);
    if (!incident) return false;
    incident.resolved = true;
    return true;
  }

  getOpenIncidents(): AuthIncident[] {
    return this.incidents.filter((i) => !i.resolved);
  }

  getAll(): AuthIncident[] {
    return [...this.incidents];
  }

  clear(): void {
    this.incidents = [];
    incidentCounter = 0;
  }
}

export const authIncidentEngine = new AuthIncidentEngine();

export function categoryForGate(gateId: string): IncidentCategory {
  const map: Record<string, IncidentCategory> = {
    maximum_mismatch_percent: 'MISMATCH_THRESHOLD',
    minimum_login_success_percent: 'LOGIN_FAILURE',
    maximum_auth_errors: 'LOGIN_FAILURE',
    maximum_session_errors: 'SESSION_ERROR',
    maximum_permission_errors: 'PERMISSION_ERROR',
    maximum_login_time_ms: 'PERFORMANCE',
    minimum_health_score: 'HEALTH',
    database_health: 'HEALTH',
    architecture_validation: 'ARCHITECTURE',
  };
  return map[gateId] ?? 'UNKNOWN';
}

export function severityForDecision(decision: 'ROLLBACK' | 'BLOCK'): IncidentSeverity {
  return decision === 'ROLLBACK' ? 'high' : 'critical';
}
