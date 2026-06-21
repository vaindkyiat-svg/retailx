import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const i = line.indexOf('=');
  if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
});

const service = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function insertProfile() {
  const userId = '473077b0-d875-4ae0-827b-d4bd5516091d';
  const email = 'admin@bankebihari.com';
  const shopId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

  const { data, error } = await service
    .from('user_profiles')
    .insert([{ id: userId, email, full_name: 'Admin User', role: 'admin', shop_id: shopId }]);

  console.log('error', error);
  console.log('data', data);
}

insertProfile().catch(console.error);
