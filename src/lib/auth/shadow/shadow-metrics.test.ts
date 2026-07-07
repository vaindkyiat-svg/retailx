/**
 * RetailX V2 Milestone D1.3 — Shadow metrics tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { shadowMetrics, PERFORMANCE_BUDGET_MS } from './shadow-metrics';

describe('ShadowMetrics', () => {
  beforeEach(() => {
    shadowMetrics.reset();
  });

  it('tracks matches and mismatches', () => {
    shadowMetrics.recordValidation('MATCH', 5, [], 'shop-1');
    shadowMetrics.recordValidation('MISMATCH', 12, ['WRONG_SHOP'], 'shop-2');

    const snap = shadowMetrics.getSnapshot();
    expect(snap.totalLogins).toBe(2);
    expect(snap.successfulMatches).toBe(1);
    expect(snap.mismatches).toBe(1);
    expect(snap.mismatchRate).toBe(50);
    expect(snap.mismatchByCategory.WRONG_SHOP).toBe(1);
    expect(snap.shopsWithMismatches).toContain('shop-2');
  });

  it('computes average and max validation time', () => {
    shadowMetrics.recordValidation('MATCH', 10, [], 'shop-1');
    shadowMetrics.recordValidation('MATCH', 20, [], 'shop-1');

    const snap = shadowMetrics.getSnapshot();
    expect(snap.averageValidationMs).toBe(15);
    expect(snap.maxValidationMs).toBe(20);
    expect(snap.performanceBudgetMs).toBe(PERFORMANCE_BUDGET_MS);
    expect(snap.withinPerformanceBudget).toBe(true);
  });

  it('flags performance budget breach', () => {
    shadowMetrics.recordValidation('MATCH', 25, [], 'shop-1');
    expect(shadowMetrics.getSnapshot().withinPerformanceBudget).toBe(false);
  });
});
