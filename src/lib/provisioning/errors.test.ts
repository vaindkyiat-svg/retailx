/**
 * RetailX V2 Sprint E1 — Provisioning error mapping tests
 */

import { describe, it, expect } from 'vitest';
import { mapProvisionError, ProvisionError } from './errors';

describe('provision errors', () => {
  it('maps EMAIL_ALREADY_EXISTS', () => {
    const err = mapProvisionError(new Error('EMAIL_ALREADY_EXISTS: test@test.com'));
    expect(err.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('maps SHOP_ALREADY_EXISTS', () => {
    const err = mapProvisionError(new Error('SHOP_ALREADY_EXISTS: My Shop'));
    expect(err.code).toBe('SHOP_ALREADY_EXISTS');
  });

  it('maps INVALID_PLAN', () => {
    const err = mapProvisionError(new Error('INVALID_PLAN: bad'));
    expect(err.code).toBe('INVALID_PLAN');
  });

  it('preserves ProvisionError', () => {
    const original = new ProvisionError('PROVISION_FAILED', 'boom');
    expect(mapProvisionError(original)).toBe(original);
  });
});
