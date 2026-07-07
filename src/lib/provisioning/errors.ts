/**
 * RetailX V2 Sprint E1 — Provisioning typed errors
 */

export type ProvisionErrorCode =
  | 'EMAIL_ALREADY_EXISTS'
  | 'SHOP_ALREADY_EXISTS'
  | 'INVALID_PLAN'
  | 'PROVISION_FAILED'
  | 'ROLLBACK_COMPLETED'
  | 'AUTH_USER_CREATE_FAILED'
  | 'RPC_FAILED'
  | 'VALIDATION_FAILED'
  | 'EDGE_FUNCTION_UNAVAILABLE'
  | 'UNKNOWN';

export interface ProvisionErrorPayload {
  code: ProvisionErrorCode;
  message: string;
  detail?: string;
}

export class ProvisionError extends Error {
  readonly code: ProvisionErrorCode;
  readonly detail?: string;

  constructor(code: ProvisionErrorCode, message: string, detail?: string) {
    super(message);
    this.name = 'ProvisionError';
    this.code = code;
    this.detail = detail;
  }

  toPayload(): ProvisionErrorPayload {
    return { code: this.code, message: this.message, detail: this.detail };
  }
}

export function isProvisionError(err: unknown): err is ProvisionError {
  return err instanceof ProvisionError;
}

export function mapProvisionError(err: unknown): ProvisionError {
  if (isProvisionError(err)) return err;

  const message = err instanceof Error ? err.message : String(err);

  if (message.includes('EMAIL_ALREADY_EXISTS')) {
    return new ProvisionError('EMAIL_ALREADY_EXISTS', 'Owner email already registered', message);
  }
  if (message.includes('SHOP_ALREADY_EXISTS')) {
    return new ProvisionError('SHOP_ALREADY_EXISTS', 'Shop already exists for this owner', message);
  }
  if (message.includes('INVALID_PLAN')) {
    return new ProvisionError('INVALID_PLAN', 'Invalid subscription plan', message);
  }
  if (message.includes('ROLLBACK')) {
    return new ProvisionError('ROLLBACK_COMPLETED', 'Provisioning rolled back', message);
  }

  return new ProvisionError('PROVISION_FAILED', message || 'Provisioning failed', message);
}
