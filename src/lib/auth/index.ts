/**

 * RetailX V2 Milestone D1.2 — Authentication module public API

 *

 * Application code must import auth operations from here only — never repositories.

 */



import { authService } from './services';



export { AuthProvider } from './AuthProvider';

export { useAuth, useAuthOptional, AuthContext, INITIAL_AUTH_STATE } from './AuthContext';



export type {

  AuthUser,

  AuthSession,

  MembershipContext,

  TenantContext,

  PermissionContext,

  AuthenticationState,

  AuthConfig,

  AuthMode,

  AuthErrorCode,

  AuthErrorPayload,

  SessionEvent,

  SessionObserverEvent,

  MembershipInput,

  V1ProfileInput,

  ResolveMembershipInput,

  ResolveTenantInput,

} from './types';



export type { IdentityContext, IdentityResolutionMode } from './identity/types';



export {

  getAuthConfig,

  getAuthConfigSync,

  resolveAuthMode,

  DEFAULT_AUTH_CONFIG,

} from './auth-config';



export { resolveMembership } from './resolve-membership';

export { resolveTenant } from './resolve-tenant';

export { buildIdentityContext, resolveIdentity } from './identity/resolve-identity';



export {

  AuthError,

  createAuthError,

  isAuthError,

  toAuthErrorPayload,

} from './errors';



export { logAuthEvent } from './auth-logger';

export type { AuthLogLevel, AuthLogMetadata } from './auth-logger';



export {

  SessionManager,

  SessionObserver,

  sessionManager,

  createSupabaseSessionObserver,

  mapSupabaseSession,

} from './session';



export { SessionStore, sessionStore } from './session-store';



export { AuthService } from './services/AuthService';

export { authService, createAuthService, getAuthService } from './services';



/** Application auth API — delegates to AuthService */

export const signIn = (email: string, password: string) => authService.signIn(email, password);

export const signOut = () => authService.signOut();

export const getAuthUser = () => authService.getAuthUser();

export const getCurrentUser = () => authService.getCurrentUser();

export const getSession = () => authService.getSession();

export const refreshSession = () => authService.refreshSession();

export const getShadowDashboardReport = () => authService.getShadowDashboardReport();
export const getPilotDashboardReport = () => authService.getPilotDashboardReport();

export { resolveAuthPath, resolveAuthPathSync, getEmergencyForceV1 } from './pilot/resolve-auth-path';
export { isPilotShopEnabled, clearPilotShopCache, getEnabledPilotShops } from './pilot/pilot-shop-client';
export { pilotMetrics } from './pilot/pilot-metrics';
export { buildPilotDashboardReport, examplePilotReport } from './pilot/PilotReport';
export type { AuthPathResolution, AuthPathSource, PilotShopRecord } from './pilot/types';

export { ShadowIdentityValidator, scheduleShadowValidation } from './shadow/ShadowIdentityValidator';
export { shadowMetrics, PERFORMANCE_BUDGET_MS } from './shadow/shadow-metrics';
export { identityValidationLog } from './shadow/identity-validation-log';
export { compareIdentitySnapshots, compareIdentityContexts } from './shadow/IdentityComparison';
export { buildShadowDashboardReport, exampleMismatchReport } from './shadow/ShadowReport';
export type { ComparisonResult, MismatchCategory, ComparisonOutcome } from './shadow/ComparisonResult';

export { RolloutController, rolloutController, defaultPilotRollbackHandler } from './release/RolloutController';
export type { RolloutEvaluateOptions, PilotRollbackHandler, PilotRollbackResult } from './release/RolloutController';
export { DEFAULT_RELEASE_GATE_CONFIG, mergeGateConfig } from './release/ReleaseGate';
export type { ReleaseGateConfig, GateDefinition } from './release/ReleaseGate';
export { collectReleaseMetrics } from './release/ReleaseMetrics';
export type { ReleaseMetricsSnapshot, ReleaseMetricsInput } from './release/ReleaseMetrics';
export { authIncidentEngine } from './release/auth-incident-engine';
export { releaseHistoryStore, recordReleaseDecision } from './release/release-history';
export { evaluateAllGates, resolveDecisionFromGates } from './release/release-gate-engine';
export {
  buildReleaseDashboardReport,
  exampleGoReport,
  exampleRollbackReport,
} from './release/ReleaseReport';
export type { ReleaseDashboardReport } from './release/ReleaseReport';
export { getReleaseDashboardReport, evaluateReleaseRollout } from './release/release-service';
export type {
  ReleaseDecision,
  ReleaseDecisionType,
  AuthIncident,
  ReleaseHistoryEntry,
  GateEvaluation,
  ReleasePhase,
  IncidentSeverity,
  IncidentCategory,
} from './release/ReleaseDecision';
