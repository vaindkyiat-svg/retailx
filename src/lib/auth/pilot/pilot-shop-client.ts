/**
 * RetailX V2 Milestone D1.4 — Pilot shop configuration client (read-only)
 */

import { supabase } from '../../supabase';
import type { PilotShopRecord } from './types';

const CACHE_TTL_MS = 5_000;

let enabledPilotShopIds: Set<string> | null = null;
let allPilotRecords: PilotShopRecord[] | null = null;
let cacheExpiry = 0;

function mapRow(row: {
  id: string;
  shop_id: string;
  enabled: boolean;
  enabled_by: string | null;
  enabled_at: string | null;
  notes: string | null;
}): PilotShopRecord {
  return {
    id: row.id,
    shopId: row.shop_id,
    enabled: row.enabled,
    enabledBy: row.enabled_by,
    enabledAt: row.enabled_at,
    notes: row.notes,
  };
}

async function refreshPilotCache(): Promise<void> {
  const now = Date.now();
  if (enabledPilotShopIds && allPilotRecords && now < cacheExpiry) {
    return;
  }

  try {
    const { data, error } = await supabase
      .from('pilot_shops')
      .select('id, shop_id, enabled, enabled_by, enabled_at, notes');

    if (error || !data) {
      enabledPilotShopIds = new Set();
      allPilotRecords = [];
      cacheExpiry = now + CACHE_TTL_MS;
      return;
    }

    const records = data.map(mapRow);
    allPilotRecords = records;
    enabledPilotShopIds = new Set(
      records.filter((r) => r.enabled).map((r) => r.shopId)
    );
    cacheExpiry = now + CACHE_TTL_MS;
  } catch {
    enabledPilotShopIds = new Set();
    allPilotRecords = [];
    cacheExpiry = now + CACHE_TTL_MS;
  }
}

/** Clear cache after rollback CLI or admin toggle — picks up within TTL otherwise. */
export function clearPilotShopCache(): void {
  enabledPilotShopIds = null;
  allPilotRecords = null;
  cacheExpiry = 0;
}

export async function isPilotShopEnabled(shopId: string): Promise<boolean> {
  if (!shopId) return false;
  await refreshPilotCache();
  return enabledPilotShopIds?.has(shopId) ?? false;
}

export async function getEnabledPilotShops(): Promise<PilotShopRecord[]> {
  await refreshPilotCache();
  return (allPilotRecords ?? []).filter((r) => r.enabled);
}

export async function getAllPilotShopRecords(): Promise<PilotShopRecord[]> {
  await refreshPilotCache();
  return allPilotRecords ?? [];
}

/** Test helper — inject pilot state without DB */
export function setPilotShopCacheForTests(records: PilotShopRecord[]): void {
  allPilotRecords = records;
  enabledPilotShopIds = new Set(records.filter((r) => r.enabled).map((r) => r.shopId));
  cacheExpiry = Date.now() + CACHE_TTL_MS;
}
