import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const envPath = resolve('.env.local');
  const env = { ...process.env };
  const txt = readFileSync(envPath, 'utf-8');
  for (const line of txt.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [k, ...rest] = line.split('=');
    env[k.trim()] = rest.join('=').trim();
  }
  return env;
}

(async () => {
  const env = loadEnv();
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const role = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !role) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const supabase = createClient(url, role);
  console.log('Connected to Supabase:', url);

  for (const table of ['pg_policies', 'information_schema.tables', 'pg_catalog.pg_policies']) {
    try {
      console.log('Querying', table);
      const { data, error } = await supabase.from(table).select('*').limit(5);
      console.log(table, 'error:', error ? JSON.stringify(error) : null);
      console.log(table, 'data:', JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Exception querying', table, err);
    }
  }
})();
