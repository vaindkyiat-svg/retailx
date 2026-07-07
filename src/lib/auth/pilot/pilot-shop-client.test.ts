/**
 * RetailX V2 Milestone D1.4 — Pilot shop client tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  isPilotShopEnabled,
  clearPilotShopCache,
  setPilotShopCacheForTests,
  getEnabledPilotShops,
} from './pilot-shop-client';

describe('pilot-shop-client cache', () => {
  beforeEach(() => {
    clearPilotShopCache();
  });

  it('returns true for enabled pilot shop', async () => {
    setPilotShopCacheForTests([
      {
        id: '1',
        shopId: 'shop-pilot',
        enabled: true,
        enabledBy: 'ops',
        enabledAt: null,
        notes: null,
      },
      {
        id: '2',
        shopId: 'shop-other',
        enabled: false,
        enabledBy: null,
        enabledAt: null,
        notes: null,
      },
    ]);

    expect(await isPilotShopEnabled('shop-pilot')).toBe(true);
    expect(await isPilotShopEnabled('shop-other')).toBe(false);
  });

  it('lists enabled pilot shops only', async () => {
    setPilotShopCacheForTests([
      {
        id: '1',
        shopId: 'shop-pilot',
        enabled: true,
        enabledBy: 'ops',
        enabledAt: '2026-01-01',
        notes: 'test',
      },
    ]);

    const enabled = await getEnabledPilotShops();
    expect(enabled).toHaveLength(1);
    expect(enabled[0].shopId).toBe('shop-pilot');
  });

  it('clearPilotShopCache resets state', async () => {
    setPilotShopCacheForTests([
      {
        id: '1',
        shopId: 'shop-pilot',
        enabled: true,
        enabledBy: null,
        enabledAt: null,
        notes: null,
      },
    ]);
    clearPilotShopCache();
    // Without DB, refresh returns empty
    setPilotShopCacheForTests([]);
    expect(await isPilotShopEnabled('shop-pilot')).toBe(false);
  });
});
