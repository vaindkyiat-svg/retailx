import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function loadEnv() {
  const envPath = resolve('.env.local');
  const env = { ...process.env };
  const txt = readFileSync(envPath, 'utf-8');
  for (const line of txt.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [k, ...rest] = line.split('=');
    env[k.trim()] = rest.join('=').trim();
  }
  return env;
}

(async () => {
  const env = loadEnv();
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const role = env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !role || !anon) {
    console.error('Missing required env vars', { url: !!url, role: !!role, anon: !!anon });
    process.exit(1);
  }

  const supabase = createClient(url, role);
  console.log('Connected to Supabase:', url);

  const userEmail = 'bb.sweets@gmail.com';
  const { data: users, error: userErr } = await supabase.auth.admin.listUsers({ filter: `email=eq.${userEmail}` });
  console.log('auth.users error:', userErr ? JSON.stringify(userErr) : null);
  console.log('auth.users count:', users?.length);
  console.log('auth.users data:', JSON.stringify(users, null, 2));

  const { data: profilesByEmail, error: profileEmailErr } = await supabase.from('user_profiles').select('*').eq('email', userEmail);
  console.log('profile by email error:', profileEmailErr ? JSON.stringify(profileEmailErr) : null);
  console.log('profiles by email count:', profilesByEmail?.length);
  console.log('profiles by email data:', JSON.stringify(profilesByEmail, null, 2));

  if (users && users.length > 0) {
    const userId = users[0].id;
    const { data: profilesById, error: profileIdErr } = await supabase.from('user_profiles').select('*').eq('id', userId);
    console.log('profile by id error:', profileIdErr ? JSON.stringify(profileIdErr) : null);
    console.log('profiles by id count:', profilesById?.length);
    console.log('profiles by id data:', JSON.stringify(profilesById, null, 2));
  }
})();
