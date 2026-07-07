/**
 * RetailX V2 Milestone C2 — Health score calculator
 */

const CATEGORY_WEIGHTS = {
  memberships: 0.25,
  branches: 0.20,
  warehouses: 0.20,
  settings: 0.15,
  subscriptions: 0.15,
  operations: 0.03,
  architecture: 0.02,
};

export function calculateHealthScore(allChecks) {
  const byCategory = {};

  for (const check of allChecks) {
    if (!byCategory[check.category]) {
      byCategory[check.category] = { total: 0, passed: 0, errors: 0, warnings: 0 };
    }
    byCategory[check.category].total++;
    if (check.passed) {
      byCategory[check.category].passed++;
    } else if (check.severity === 'warning') {
      byCategory[check.category].warnings++;
    } else {
      byCategory[check.category].errors++;
    }
  }

  const categories = {};
  let weightedSum = 0;
  let weightTotal = 0;

  for (const [cat, stats] of Object.entries(byCategory)) {
    const score = stats.total > 0 ? (stats.passed / stats.total) * 100 : 100;
    categories[cat] = {
      score: round(score),
      passed: stats.passed,
      total: stats.total,
      errors: stats.errors,
      warnings: stats.warnings,
    };

    const w = CATEGORY_WEIGHTS[cat] ?? 0.01;
    weightedSum += score * w;
    weightTotal += w;
  }

  const overall = weightTotal > 0 ? weightedSum / weightTotal : 100;

  return {
    overall: round(overall),
    categories,
    status: deriveStatus(overall),
  };
}

function deriveStatus(score) {
  if (score >= 99.5) return 'healthy';
  if (score >= 90) return 'degraded';
  return 'unhealthy';
}

function round(n) {
  return Math.round(n * 100) / 100;
}

export function collectRepairSuggestions(checks) {
  const suggestions = new Map();

  for (const check of checks) {
    if (!check.passed && check.repair) {
      if (!suggestions.has(check.repair)) {
        suggestions.set(check.repair, []);
      }
      suggestions.get(check.repair).push({
        check: check.name,
        count: check.count,
        severity: check.severity,
      });
    }
  }

  return Object.fromEntries(suggestions);
}
