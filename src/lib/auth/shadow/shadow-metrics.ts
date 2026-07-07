/**
 * RetailX V2 Milestone D1.3 — Shadow validation metrics
 */

import type { ComparisonOutcome, MismatchCategory } from './ComparisonResult';

export interface ShadowMetricsSnapshot {
  totalLogins: number;
  successfulMatches: number;
  mismatches: number;
  mismatchRate: number;
  averageValidationMs: number;
  maxValidationMs: number;
  mismatchByCategory: Record<string, number>;
  shopsWithMismatches: string[];
  performanceBudgetMs: number;
  withinPerformanceBudget: boolean;
}

const PERFORMANCE_BUDGET_MS = 20;

export class ShadowMetrics {
  private totalLogins = 0;
  private successfulMatches = 0;
  private mismatches = 0;
  private totalDurationMs = 0;
  private maxDurationMs = 0;
  private mismatchByCategory = new Map<MismatchCategory, number>();
  private shopsWithMismatches = new Set<string>();
  private durationHistory: number[] = [];

  recordValidation(outcome: ComparisonOutcome, durationMs: number, categories: MismatchCategory[], shopId: string | null): void {
    this.totalLogins++;
    this.totalDurationMs += durationMs;
    this.maxDurationMs = Math.max(this.maxDurationMs, durationMs);
    this.durationHistory.push(durationMs);

    if (outcome === 'MATCH') {
      this.successfulMatches++;
    } else {
      this.mismatches++;
      if (shopId) this.shopsWithMismatches.add(shopId);
      for (const cat of categories) {
        this.mismatchByCategory.set(cat, (this.mismatchByCategory.get(cat) ?? 0) + 1);
      }
    }
  }

  getSnapshot(): ShadowMetricsSnapshot {
    const mismatchRate = this.totalLogins > 0 ? (this.mismatches / this.totalLogins) * 100 : 0;
    const averageValidationMs = this.totalLogins > 0 ? this.totalDurationMs / this.totalLogins : 0;

    const mismatchByCategory: Record<string, number> = {};
    for (const [cat, count] of this.mismatchByCategory) {
      mismatchByCategory[cat] = count;
    }

    return {
      totalLogins: this.totalLogins,
      successfulMatches: this.successfulMatches,
      mismatches: this.mismatches,
      mismatchRate: round(mismatchRate),
      averageValidationMs: round(averageValidationMs),
      maxValidationMs: this.maxDurationMs,
      mismatchByCategory,
      shopsWithMismatches: [...this.shopsWithMismatches],
      performanceBudgetMs: PERFORMANCE_BUDGET_MS,
      withinPerformanceBudget: averageValidationMs <= PERFORMANCE_BUDGET_MS,
    };
  }

  reset(): void {
    this.totalLogins = 0;
    this.successfulMatches = 0;
    this.mismatches = 0;
    this.totalDurationMs = 0;
    this.maxDurationMs = 0;
    this.mismatchByCategory.clear();
    this.shopsWithMismatches.clear();
    this.durationHistory = [];
  }
}

export const shadowMetrics = new ShadowMetrics();

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export { PERFORMANCE_BUDGET_MS };
