import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const i = line.indexOf('=');
  if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
});

const service = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  const { data, error } = await service
    .from('orders')
    .select('*')
    .eq('shop_id', 'b3a669ce-eee3-4b18-b5ce-6b9685168e27');

  console.log('error', error);
  console.log('data', data);
}

verify().catch(console.error);
