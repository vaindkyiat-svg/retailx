/**
 * RetailX V2 Sprint E1 — Provisioning input validation
 */

import { ProvisionError } from './errors';
import type { ProvisionShopInput } from './types';

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function validateProvisionInput(input: ProvisionShopInput): void {
  if (!input.shopName?.trim()) {
    throw new ProvisionError('VALIDATION_FAILED', 'Shop name is required');
  }
  if (!input.ownerName?.trim()) {
    throw new ProvisionError('VALIDATION_FAILED', 'Owner name is required');
  }
  if (!input.ownerEmail?.trim() || !EMAIL_RE.test(input.ownerEmail.trim())) {
    throw new ProvisionError('VALIDATION_FAILED', 'Valid owner email is required');
  }
  if (!input.phone?.trim()) {
    throw new ProvisionError('VALIDATION_FAILED', 'Phone is required');
  }
}

export function buildIdempotencyKey(input: ProvisionShopInput): string {
  if (input.idempotencyKey?.trim()) return input.idempotencyKey.trim();
  const normalized = `${input.ownerEmail.trim().toLowerCase()}::${input.shopName.trim().toLowerCase()}`;
  return `provision-${hashString(normalized)}`;
}

export function generateTemporaryPassword(): string {
  const words = ['shop', 'pos', 'retail', 'store'];
  const word = words[Math.floor(Math.random() * words.length)];
  return `${word}@${Math.floor(1000 + Math.random() * 9000)}`;
}

export function generateLegacyUsername(shopName: string): string {
  const base =
    shopName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 12) || 'shop';
  return `${base}${Math.floor(Math.random() * 100000)}`;
}

function hashString(value: string): string {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
