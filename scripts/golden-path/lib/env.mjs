/**
 * RetailX V2 Sprint E2 — Load environment from .env.local
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getProjectRoot } from '../../infrastructure/lib/helpers.mjs';

export function loadEnv() {
  const path = join(getProjectRoot(), '.env.local');
  const env = { ...process.env };

  if (existsSync(path)) {
    const raw = readFileSync(path, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const i = trimmed.indexOf('=');
      if (i <= 0) continue;
      env[trimmed.slice(0, i).trim()] = trimmed.slice(i + 1).trim();
    }
  }

  return {
    supabaseUrl: env.VITE_SUPABASE_URL || env.SUPABASE_URL,
    anonKey: env.VITE_SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    databaseUrl: env.DATABASE_URL,
    adminEmail: env.GOLDEN_PATH_ADMIN_EMAIL || 'admin@bankebihari.com',
    adminPassword: env.GOLDEN_PATH_ADMIN_PASSWORD || 'Admin@12345',
  };
}

export function requireSupabaseEnv(env) {
  if (!env.supabaseUrl || !env.anonKey) {
    throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
  }
  if (!env.serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY in .env.local');
  }
}

export async function checkSupabaseConnectivity(env) {
  try {
    const res = await fetch(`${env.supabaseUrl}/rest/v1/`, {
      headers: { apikey: env.anonKey },
    });
    return res.ok || res.status === 401 || res.status === 404;
  } catch {
    return false;
  }
}
