/**
 * RetailX V2 Sprint E1 — In-memory provisioning logs
 */

import type { ProvisionLogEntry } from './types';

export class ProvisionLogger {
  private entries: ProvisionLogEntry[] = [];

  log(step: string, status: string, detail?: Record<string, unknown>): void {
    this.entries.push({
      step,
      status,
      detail,
      timestamp: new Date().toISOString(),
    });
  }

  getEntries(): ProvisionLogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }
}

export const provisionLogger = new ProvisionLogger();
