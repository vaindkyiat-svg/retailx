import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// NOTE: Do NOT expose the Service Role key to the client bundle. This factory
// is intended for server-side usage only (serverless functions, scripts).
export function createServiceSupabase(serviceRoleKey?: string) {
  const key = serviceRoleKey || (typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined);
  if (!key) {
    // Return null-like behavior so callers can fallback to the public client.
    return null;
  }
  return createClient(supabaseUrl, key, { auth: { persistSession: false } });
}

export type Database = any; // You can add a generated type from Supabase CLI
