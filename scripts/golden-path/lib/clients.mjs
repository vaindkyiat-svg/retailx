/**
 * RetailX V2 Sprint E2 — Supabase clients
 */

import { createClient } from '@supabase/supabase-js';

export function createServiceClient(env) {
  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createAnonClient(env) {
  return createClient(env.supabaseUrl, env.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
