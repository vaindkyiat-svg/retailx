import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const txt = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(txt.split(/\r?\n/).filter(Boolean).map((l) => {
  const i = l.indexOf('=');
  return [l.slice(0, i), l.slice(i + 1)];
}));

const client = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const res = await client.rpc('exec', { sql: 'SELECT 1 as x' });
console.log(JSON.stringify(res, null, 2));
