/**
 * RetailX V2 Milestone D1.3 — Identity validation log (in-memory store)
 */

import type { IdentityValidationLogEntry } from './ComparisonResult';

const MAX_ENTRIES = 500;

class IdentityValidationLog {
  private entries: IdentityValidationLogEntry[] = [];

  append(entry: IdentityValidationLogEntry): void {
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES);
    }
  }

  getAll(): IdentityValidationLogEntry[] {
    return [...this.entries];
  }

  getRecent(limit = 50): IdentityValidationLogEntry[] {
    return this.entries.slice(-limit);
  }

  clear(): void {
    this.entries = [];
  }
}

export const identityValidationLog = new IdentityValidationLog();

export function createLogEntry(
  result: {
    correlationId: string;
    userId: string;
    shopId: string | null;
    email: string | null;
    outcome: IdentityValidationLogEntry['outcome'];
    durationMs: number;
    categories: IdentityValidationLogEntry['mismatchCategories'];
    mismatches: { length: number };
  },
  trigger: IdentityValidationLogEntry['trigger']
): IdentityValidationLogEntry {
  return {
    id: `ivl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    correlationId: result.correlationId,
    timestamp: new Date().toISOString(),
    userId: result.userId,
    shopId: result.shopId,
    email: result.email,
    outcome: result.outcome,
    durationMs: result.durationMs,
    mismatchCategories: result.categories,
    mismatchCount: result.mismatches.length,
    trigger,
  };
}
