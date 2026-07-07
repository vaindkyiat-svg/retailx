/**
 * RetailX V2 Milestone D1.4A — Release history (in-memory + archive shape)
 */

import type { ReleaseDecisionType, ReleaseHistoryEntry } from './ReleaseDecision';

let historyCounter = 0;

export class ReleaseHistoryStore {
  private entries: ReleaseHistoryEntry[] = [];
  private readonly maxEntries = 200;

  append(entry: Omit<ReleaseHistoryEntry, 'id' | 'createdAt'>): ReleaseHistoryEntry {
    const full: ReleaseHistoryEntry = {
      ...entry,
      id: `rel-${Date.now()}-${++historyCounter}`,
      createdAt: new Date().toISOString(),
    };
    this.entries.push(full);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
    return full;
  }

  getAll(): ReleaseHistoryEntry[] {
    return [...this.entries];
  }

  getRecent(limit = 20): ReleaseHistoryEntry[] {
    return this.entries.slice(-limit);
  }

  clear(): void {
    this.entries = [];
    historyCounter = 0;
  }
}

export const releaseHistoryStore = new ReleaseHistoryStore();

export function recordReleaseDecision(input: {
  version: string;
  shopId: string | null;
  decision: ReleaseDecisionType;
  metricsSnapshot: Record<string, unknown>;
  approvedBy?: string | null;
  rollback?: boolean;
  durationMs?: number | null;
  reasons: string[];
}): ReleaseHistoryEntry {
  return releaseHistoryStore.append({
    version: input.version,
    shopId: input.shopId,
    decision: input.decision,
    metricsSnapshot: input.metricsSnapshot,
    approvedBy: input.approvedBy ?? null,
    rollback: input.rollback ?? input.decision === 'ROLLBACK',
    durationMs: input.durationMs ?? null,
    reasons: input.reasons,
  });
}
