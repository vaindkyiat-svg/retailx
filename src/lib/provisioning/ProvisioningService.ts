/**
 * RetailX V2 Sprint E1 — Shop provisioning service (single entry point)
 */

import { createServiceSupabase } from '../supabase';
import { validateProvisionedShop } from './business-validation';
import { mapProvisionError } from './errors';
import { provisionLogger } from './provision-logger';
import {
  orchestrateProvision,
  orchestrateProvisionViaEdge,
} from './provision-orchestrator';
import type { BusinessValidationResult, ProvisionShopInput, ProvisionShopResult } from './types';

export class ProvisioningService {
  /**
   * Provision a complete operational shop in one atomic flow.
   * Uses service role when available; otherwise edge function.
   */
  async provision(input: ProvisionShopInput): Promise<ProvisionShopResult> {
    try {
      const hasServiceRole = !!createServiceSupabase(
        typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined
      );

      const result = hasServiceRole
        ? await orchestrateProvision(input)
        : await orchestrateProvisionViaEdge(input);

      provisionLogger.log('provision_complete', 'completed', {
        shopId: result.shopId,
        ownerUserId: result.ownerUserId,
      });

      return result;
    } catch (err) {
      provisionLogger.log('provision_complete', 'failed', {
        message: err instanceof Error ? err.message : 'unknown',
      });
      throw mapProvisionError(err);
    }
  }

  /** Retry-safe — same idempotency key returns existing shop */
  async retry(input: ProvisionShopInput): Promise<ProvisionShopResult> {
    return this.provision(input);
  }

  async validateBusinessRules(shopId: string): Promise<BusinessValidationResult> {
    return validateProvisionedShop(shopId);
  }

  getLogs() {
    return provisionLogger.getEntries();
  }
}

export const provisioningService = new ProvisioningService();

export async function provisionShop(input: ProvisionShopInput): Promise<ProvisionShopResult> {
  return provisioningService.provision(input);
}
