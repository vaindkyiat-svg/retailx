/**
 * RetailX V2 Sprint E1 — Provisioning validator tests
 */

import { describe, it, expect } from 'vitest';
import {
  validateProvisionInput,
  buildIdempotencyKey,
  generateTemporaryPassword,
} from './provision-validator';
import { ProvisionError } from './errors';

describe('provision-validator', () => {
  const validInput = {
    shopName: 'Test Shop',
    ownerName: 'Owner',
    ownerEmail: 'owner@test.com',
    phone: '9999999999',
  };

  it('accepts valid input', () => {
    expect(() => validateProvisionInput(validInput)).not.toThrow();
  });

  it('rejects missing email', () => {
    expect(() => validateProvisionInput({ ...validInput, ownerEmail: '' })).toThrow(ProvisionError);
  });

  it('builds stable idempotency key', () => {
    const a = buildIdempotencyKey(validInput);
    const b = buildIdempotencyKey(validInput);
    expect(a).toBe(b);
    expect(a.startsWith('provision-')).toBe(true);
  });

  it('generates temporary password', () => {
    const pwd = generateTemporaryPassword();
    expect(pwd).toMatch(/^(shop|pos|retail|store)@\d{4}$/);
  });
});
