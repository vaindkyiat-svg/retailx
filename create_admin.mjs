import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const i = line.indexOf('=');
  if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
});

const service = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function createAdmin() {
  const email = 'admin@bankebihari.com';
  const password = 'Admin@12345';
  const shopId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

  console.log('Creating auth user...');
  try {
    const resp = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    console.log('createUser response:', JSON.stringify(resp, null, 2));

    const userId = resp?.data?.user?.id || resp?.user?.id || resp?.data?.id;
    if (!userId) {
      console.error('Could not determine created user id from response.');
      return;
    }

    console.log('Auth user created:', userId);

    console.log('Inserting user_profiles row...');
    const { data, error } = await service
      .from('user_profiles')
      .insert([{ id: userId, email, full_name: 'Admin User', role: 'admin', shop_id: shopId }]);

    if (error) {
      console.error('Error inserting profile:', error);
      return;
    }

    console.log('Inserted profile:', data);
    console.log('\nAdmin creation complete. Sign in with:', email, password);
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

createAdmin().catch(console.error);
