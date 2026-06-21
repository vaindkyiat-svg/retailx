import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const i = line.indexOf('=');
  if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
});

const service = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function run() {
  const email = 'arjun.sweets@example.com';
  const password = 'shop@7283';
  const shopId = 'b3a669ce-eee3-4b18-b5ce-6b9685168e27';

  const resp = await service.auth.admin.createUser({ email, password, email_confirm: true });
  console.log('createUser resp:', JSON.stringify(resp, null, 2));
  const userId = resp?.data?.user?.id || resp?.user?.id || resp?.data?.id;
  if (!userId) {
    console.log('User may already exist; listing users to find id...');
    const list = await service.auth.admin.listUsers();
    const u = list.data.users.find(u => u.email === email);
    if (!u) { console.log('Could not find user'); return; }
    console.log('Found user id:', u.id);
    userId = u.id;
  }

  const { data, error } = await service.from('user_profiles').insert([{ id: userId, email, full_name: 'Arjun Kumar', role: 'shop_owner', shop_id: shopId }]);
  console.log('insert profile error', error);
  console.log('insert profile data', data);
}

run().catch(console.error);
