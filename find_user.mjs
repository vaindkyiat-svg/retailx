import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const i = line.indexOf('=');
  if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
});

const service = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function findUser() {
  const email = 'admin@bankebihari.com';
  const { data, error } = await service
    .from('users')
    .select('id,email')
    .eq('email', email);

  console.log('error', error);
  console.log('data', data);
}

findUser().catch(console.error);
