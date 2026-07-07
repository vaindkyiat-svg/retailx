/**
 * RetailX V2 Milestone D1.2 + D1.4 — Authentication service
 *
 * Single entry point for application auth. Feature flag + pilot routing happens here only.
 * D1.3: Shadow validation runs async after sign-in — never blocks login.
 * D1.4: Per-shop pilot enables membership auth for one internal shop only.
 */

import { getAuthConfig } from '../auth-config';
import { logAuthEvent } from '../auth-logger';
import { createAuthError, isAuthError, toAuthErrorPayload } from '../errors';
import type { AuthSession, AuthUser } from '../types';
import type { IdentityContext } from '../identity/types';
import type { IAuthRepository } from '../repositories/interfaces';
import {
  getAllPilotShopRecords,
  getEnabledPilotShops,
  isPilotShopEnabled,
} from '../pilot/pilot-shop-client';
import { getEmergencyForceV1, resolveAuthPath } from '../pilot/resolve-auth-path';
import { pilotMetrics } from '../pilot/pilot-metrics';
import {
  buildPilotDashboardReport,
  toPilotHtml,
  toPilotMarkdown,
} from '../pilot/PilotReport';
import type { AuthPathResolution } from '../pilot/types';
import {
  ShadowIdentityValidator,
  scheduleShadowValidation,
} from '../shadow/ShadowIdentityValidator';

export class AuthService {
  private readonly shadowValidator: ShadowIdentityValidator;
  private lastAuthPath: AuthPathResolution | null = null;

  constructor(private readonly repository: IAuthRepository) {
    this.shadowValidator = new ShadowIdentityValidator(repository);
  }

  /** Last resolved auth path (for dashboard / debugging). */
  getLastAuthPath(): AuthPathResolution | null {
    return this.lastAuthPath;
  }

  /**
   * Resolve shop-scoped auth path then full identity context.
   * Decision order: emergency → pilot → global → legacy.
   */
  async resolveIdentityContext(): Promise<IdentityContext | null> {
    const globalConfig = await getAuthConfig();
    pilotMetrics.setEmergencyForceV1(getEmergencyForceV1());

    const supabaseUser = await this.repository.getCurrentUser();
    if (!supabaseUser) return null;

    let shopId: string | undefined;
    try {
      const profile = await this.repository.fetchV1Profile(supabaseUser.id);
      shopId = profile?.shopId;
    } catch {
      logAuthEvent('debug', 'Profile lookup for pilot routing failed', {
        userId: supabaseUser.id,
      });
    }

    const enabledPilots = await getEnabledPilotShops();
    pilotMetrics.setActivePilotShops(enabledPilots.map((p) => p.shopId));

    const authPath = await resolveAuthPath(shopId, globalConfig, isPilotShopEnabled);
    this.lastAuthPath = authPath;

    try {
      const identity = await this.repository.resolveIdentity({
        useMembershipAuth: authPath.useMembershipAuth,
      });

      if (identity) {
        logAuthEvent('info', 'Identity resolved', {
          userId: identity.user.id,
          mode: identity.resolutionMode,
          shopId: identity.user.shop_id,
          authPath: authPath.source,
          pilot: authPath.pilotEnabled ?? false,
        });
      }

      return identity;
    } catch (err) {
      const payload = toAuthErrorPayload(err);
      logAuthEvent('warn', 'Identity resolution failed', { code: payload.code });
      if (authPath.source === 'pilot') {
        pilotMetrics.recordPermissionError();
      }
      return null;
    }
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const identity = await this.resolveIdentityContext();
    return identity?.user ?? null;
  }

  /** @deprecated Alias for getCurrentUser — backward compatible with V1 API */
  async getAuthUser(): Promise<AuthUser | null> {
    return this.getCurrentUser();
  }

  async getSession(): Promise<AuthSession | null> {
    try {
      return await this.repository.getSession();
    } catch (err) {
      pilotMetrics.recordSessionError();
      logAuthEvent('warn', 'Get session failed', { code: toAuthErrorPayload(err).code });
      return null;
    }
  }

  async refreshSession(): Promise<AuthSession | null> {
    try {
      const session = await this.repository.refreshSession();
      logAuthEvent('info', 'Session refreshed', { userId: session?.userId });
      return session;
    } catch (err) {
      pilotMetrics.recordSessionError();
      logAuthEvent('warn', 'Session refresh failed', { code: toAuthErrorPayload(err).code });
      return null;
    }
  }

  async signIn(email: string, password: string): Promise<AuthUser | null> {
    logAuthEvent('info', 'Sign in requested', { email: maskEmail(email) });
    const startedAt = performance.now();

    try {
      await this.repository.signIn(email, password);
      const user = await this.getCurrentUser();

      if (!user) {
        throw createAuthError('AUTH_USER_NOT_FOUND');
      }

      const durationMs = Math.round(performance.now() - startedAt);
      const path = this.lastAuthPath;

      pilotMetrics.recordLoginSuccess(
        user.shop_id,
        user.id,
        durationMs,
        path?.source ?? 'legacy'
      );

      logAuthEvent('info', 'Sign in succeeded', {
        userId: user.id,
        authPath: path?.source,
        durationMs,
      });

      // D1.3 shadow validation — async, non-blocking; still active during pilot
      scheduleShadowValidation(this.shadowValidator, 'sign_in');

      return user;
    } catch (err) {
      const durationMs = Math.round(performance.now() - startedAt);
      pilotMetrics.recordLoginFailure(undefined, durationMs);

      const payload = isAuthError(err) ? err.toPayload() : toAuthErrorPayload(err);
      logAuthEvent('warn', 'Sign in failed', { code: payload.code });
      return null;
    }
  }

  async signOut(): Promise<boolean> {
    logAuthEvent('info', 'Sign out requested');

    try {
      await this.repository.signOut();
      pilotMetrics.clearCurrentUsers();
      logAuthEvent('info', 'Sign out succeeded');
      return true;
    } catch (err) {
      logAuthEvent('warn', 'Sign out failed', { code: toAuthErrorPayload(err).code });
      return false;
    }
  }

  /** Shadow mode dashboard — V1 authoritative metrics only */
  getShadowDashboardReport() {
    return this.shadowValidator.getDashboardReport();
  }

  /** Pilot shop dashboard — D1.4 monitoring */
  async getPilotDashboardReport() {
    const metrics = pilotMetrics.getSnapshot();
    const pilotShops = await getAllPilotShopRecords();
    const report = buildPilotDashboardReport(metrics, pilotShops);
    return {
      json: report,
      markdown: toPilotMarkdown(report),
      html: toPilotHtml(report),
    };
  }
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}
