/**
 * RetailX V2 Milestone D1.2 — Repository-layer technical logging
 */

import type { AuthLogMetadata } from '../auth-logger';
import { logAuthEvent } from '../auth-logger';

export function logRepositoryEvent(
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  metadata: AuthLogMetadata = {}
): void {
  logAuthEvent(level, message, { ...metadata, layer: 'repository' });
}
