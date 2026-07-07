/**
 * RetailX V2 Milestone D1.3 — Shadow identity validator
 *
 * Runs V1 (authoritative) and V2 (shadow) resolution in parallel for comparison.
 * Never modifies session, permissions, or login outcome.
 */

import { logAuthEvent } from '../auth-logger';
import type { IAuthRepository } from '../repositories/interfaces';
import { compareIdentityContexts } from './IdentityComparison';
import type { ComparisonResult } from './ComparisonResult';
import { createLogEntry, identityValidationLog } from './identity-validation-log';
import { isPilotShopEnabled } from '../pilot/pilot-shop-client';
import { pilotMetrics } from '../pilot/pilot-metrics';
import { shadowMetrics, PERFORMANCE_BUDGET_MS } from './shadow-metrics';
import {
  buildShadowDashboardReport,
  toShadowHtml,
  toShadowMarkdown,
} from './ShadowReport';

export type ShadowTrigger = 'sign_in' | 'session_restore';

export class ShadowIdentityValidator {
  constructor(private readonly repository: IAuthRepository) {}

  /**
   * Execute shadow validation. Safe to call async — failures are swallowed by caller.
   */
  async validate(trigger: ShadowTrigger = 'sign_in'): Promise<ComparisonResult | null> {
    const correlationId = `shadow-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const startedAt = performance.now();

    try {
      const [v1Context, v2Context, session] = await Promise.all([
        this.repository.resolveIdentity({ useMembershipAuth: false }),
        this.repository.resolveIdentity({ useMembershipAuth: true }),
        this.repository.getSession(),
      ]);

      const branchCodes = {
        v1: v1Context?.user.shop_id
          ? await this.repository.fetchMainBranchCode(v1Context.user.shop_id)
          : null,
        v2: v2Context?.user.shop_id
          ? await this.repository.fetchMainBranchCode(v2Context.user.shop_id)
          : null,
      };

      const durationMs = Math.round(performance.now() - startedAt);

      const result = compareIdentityContexts(v1Context, v2Context, session, branchCodes, {
        correlationId,
        durationMs,
      });

      await this.recordResult(result, trigger);

      logAuthEvent('debug', 'Shadow identity validation complete', {
        correlationId,
        outcome: result.outcome,
        durationMs,
        mode: 'shadow',
        userId: result.userId,
      });

      if (durationMs > PERFORMANCE_BUDGET_MS) {
        logAuthEvent('warn', 'Shadow validation exceeded performance budget', {
          durationMs,
          budgetMs: PERFORMANCE_BUDGET_MS,
          correlationId,
        });
      }

      return result;
    } catch (err) {
      logAuthEvent('warn', 'Shadow validation failed (ignored)', {
        correlationId,
        mode: 'shadow',
        message: err instanceof Error ? err.message : 'unknown',
      });
      return null;
    }
  }

  private async recordResult(result: ComparisonResult, trigger: ShadowTrigger): Promise<void> {
    identityValidationLog.append(createLogEntry(result, trigger));
    shadowMetrics.recordValidation(
      result.outcome,
      result.durationMs,
      result.categories,
      result.shopId
    );

    if (result.shopId) {
      const isPilot = await isPilotShopEnabled(result.shopId);
      pilotMetrics.recordShadowOutcome(result.outcome, result.shopId, isPilot);
    }
  }

  getDashboardReport() {
    const metrics = shadowMetrics.getSnapshot();
    const entries = identityValidationLog.getAll();
    const report = buildShadowDashboardReport(metrics, entries);
    return {
      json: report,
      markdown: toShadowMarkdown(report),
      html: toShadowHtml(report),
    };
  }
}

/** Schedule validation without blocking caller (fire-and-forget) */
export function scheduleShadowValidation(
  validator: ShadowIdentityValidator,
  trigger: ShadowTrigger = 'sign_in'
): void {
  queueMicrotask(() => {
    void validator.validate(trigger);
  });
}
