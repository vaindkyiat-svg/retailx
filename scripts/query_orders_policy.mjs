import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const envPath = resolve('.env.local');
  const raw = readFileSync(envPath, 'utf8');
  return Object.fromEntries(raw.split(/\r?\n/).filter(Boolean).map(line => {
    const idx = line.indexOf('=');
    return [line.slice(0, idx), line.slice(idx + 1)];
  }));
}

(async () => {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing env');
    process.exit(1);
  }
  const supabase = createClient(url, key);
  const sql = `SELECT policyname, permissive, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname='public' AND tablename='orders';`;
  const { data, error } = await supabase.rpc('exec', { sql });
  console.log('error=', error);
  console.log('data=', data);
})();
