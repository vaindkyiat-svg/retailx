/**
 * RetailX V2 Sprint E1 — Shop provisioning public API
 */

export { ProvisioningService, provisioningService, provisionShop } from './ProvisioningService';
export { validateProvisionedShop } from './business-validation';
export { provisionLogger } from './provision-logger';
export {
  validateProvisionInput,
  buildIdempotencyKey,
  generateTemporaryPassword,
  generateLegacyUsername,
} from './provision-validator';
export { ProvisionError, isProvisionError, mapProvisionError } from './errors';
export type { ProvisionErrorCode, ProvisionErrorPayload } from './errors';
export type {
  ProvisionShopInput,
  ProvisionShopResult,
  BusinessValidationResult,
  ProvisionLogEntry,
} from './types';
