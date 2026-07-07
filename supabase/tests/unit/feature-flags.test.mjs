/**
 * RetailX V2 — Feature flag unit tests (no database required)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// Inline copies of pure functions for Node test runner (no TS compile step)
const FEATURE_FLAGS = {
  USE_V2_PROVISIONING: 'USE_V2_PROVISIONING',
  USE_MEMBERSHIP_AUTH: 'USE_MEMBERSHIP_AUTH',
  USE_MEMBERSHIP_RLS: 'USE_MEMBERSHIP_RLS',
  WRITE_LEGACY_CREDENTIALS: 'WRITE_LEGACY_CREDENTIALS',
};

function resolveFlag(key, record, environment, defaultValue = false) {
  const envKey = `RETAILX_FLAG_${key}`;
  const raw = process.env[envKey];
  if (raw !== undefined && raw !== '') {
    return raw === 'true' || raw === '1';
  }

  if (record) {
    const envSpecific = record.environments?.[environment];
    if (envSpecific !== undefined) return envSpecific;
    return record.enabled;
  }

  return defaultValue;
}

describe('feature flags', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.RETAILX_FLAG_USE_V2_PROVISIONING;
    delete process.env.RETAILX_FLAG_USE_MEMBERSHIP_AUTH;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('env override takes precedence', () => {
    process.env.RETAILX_FLAG_USE_V2_PROVISIONING = 'true';
    const result = resolveFlag(
      FEATURE_FLAGS.USE_V2_PROVISIONING,
      { key: FEATURE_FLAGS.USE_V2_PROVISIONING, enabled: false },
      'production'
    );
    assert.equal(result, true);
  });

  it('environment-specific value overrides global enabled', () => {
    const result = resolveFlag(
      FEATURE_FLAGS.USE_MEMBERSHIP_AUTH,
      {
        key: FEATURE_FLAGS.USE_MEMBERSHIP_AUTH,
        enabled: false,
        environments: { development: true, staging: false, production: false },
      },
      'development'
    );
    assert.equal(result, true);
  });

  it('falls back to default when no record', () => {
    const result = resolveFlag(FEATURE_FLAGS.USE_MEMBERSHIP_RLS, undefined, 'staging', false);
    assert.equal(result, false);
  });

  it('WRITE_LEGACY_CREDENTIALS defaults true in seed', () => {
    const result = resolveFlag(
      FEATURE_FLAGS.WRITE_LEGACY_CREDENTIALS,
      {
        key: FEATURE_FLAGS.WRITE_LEGACY_CREDENTIALS,
        enabled: true,
        environments: { development: true, staging: true, production: true },
      },
      'production'
    );
    assert.equal(result, true);
  });
});
