import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const envPath = resolve('.env.local');
  const env = { ...process.env };
  try {
    const txt = readFileSync(envPath, 'utf-8');
    for (const line of txt.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [k, ...rest] = line.split('=');
      env[k.trim()] = rest.join('=').trim();
    }
  } catch (e) {
    // ignore if no file
  }
  return env;
}

(async () => {
  const env = loadEnv();
  const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment or .env.local');
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY and re-run.');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Inputs (can be overridden via env)
  const SHOP_ID = env.SHOP_ID || 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  const EMAIL = env.TEST_USER_EMAIL || 'bb.sweets@gmail.com';
  const PASSWORD = env.TEST_USER_PASSWORD || 'bihari@123';
  const FULL_NAME = env.TEST_USER_FULL_NAME || 'Gopal Krishna Sharma';
  const ROLE = env.TEST_USER_ROLE || 'shop_owner';

  try {
    console.log('Creating auth user:', EMAIL);
    const { data: userData, error: createErr } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: FULL_NAME },
    });

    if (createErr) {
      console.error('Error creating user:', createErr);
      // If user already exists, try to fetch it
      const { data: existingUsers, error: listErr } = await supabase.auth.admin.listUsers({
        filter: `email=eq.${EMAIL}`,
      });
      if (listErr) {
        console.error('Also failed to list users:', listErr);
        process.exit(1);
      }
      if (!existingUsers || existingUsers.length === 0) {
        console.error('No existing user found; aborting.');
        process.exit(1);
      }
      userData.user = existingUsers[0];
      console.log('Using existing user:', userData.user.id);
    }

    const userId = userData.user.id;
    console.log('User id:', userId);

    console.log('Upserting user_profiles row...');
    const { data: upsertData, error: upsertErr } = await supabase
      .from('user_profiles')
      .upsert([
        {
          id: userId,
          email: EMAIL,
          full_name: FULL_NAME,
          role: ROLE,
          shop_id: SHOP_ID,
        },
      ], { onConflict: 'id' })
      .select();

    if (upsertErr) {
      console.error('Error upserting user_profiles:', upsertErr);
      process.exit(1);
    }

    console.log('user_profiles upserted:', upsertData);
    console.log('Done. You can now sign in via the frontend using:', EMAIL, PASSWORD);
  } catch (err) {
    console.error('Unexpected error:', err);
    process.exit(1);
  }
})();
