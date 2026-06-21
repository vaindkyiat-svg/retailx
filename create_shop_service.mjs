import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const i = line.indexOf('=');
  if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
});

const service = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function createShop() {
  const shop = {
    name: 'Arjun Sweets & Bakery',
    owner_name: 'Arjun Kumar',
    owner_phone: '+91 98765 43210',
    address: 'Shop Road, Vrindavan',
    gst_no: null,
    owner_email: 'arjun.sweets@example.com',
    shop_name: 'Arjun Sweets & Bakery',
    city: 'Vrindavan',
    state: 'Uttar Pradesh',
    category: 'Bakery',
    username: 'arjunsweetsb32',
    password: 'shop@7283',
    status: 'active',
    plan: 'standard',
    registered_on: new Date().toISOString().slice(0,10)
  };

  const { data, error } = await service
    .from('shops')
    .insert([shop])
    .select();

  console.log('error', error);
  console.log('data', data);
}

createShop().catch(console.error);
