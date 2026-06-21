const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
function readEnv(file) {
  const raw = fs.readFileSync(path.resolve(file), 'utf8');
  return Object.fromEntries(raw.split(/\r?\n/).filter(Boolean).map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1)]; }));
}
(async function(){
  const env = readEnv('.env.local');
  const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const serviceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url || !serviceKey){ console.error('Missing env'); process.exit(1); }
  const svc = createClient(url, serviceKey);
  const { data, error } = await svc.from('pg_policies').select('policyname, permissive, roles, cmd, qual, with_check').eq('schemaname', 'public').eq('tablename', 'orders');
  console.log('error=', error);
  console.log('data=', data);
})();
