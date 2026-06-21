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
  const url = env.VITE_SUPABASE_URL;
  const anon = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const client = createClient(url, anon);
  const email = 'bb.sweets@gmail.com';
  const password = 'bihari@123';

  console.log('Signing in with anon key...');
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  console.log('signIn error:', error ? JSON.stringify(error) : null);
  console.log('signIn data:', JSON.stringify(data, null, 2));

  if (!data?.user) {
    console.error('Sign-in failed; no user returned.');
    process.exit(1);
  }

  const user = data.user;
  console.log('User id:', user.id);

  const userRes = await client.auth.getUser();
  console.log('getUser error:', JSON.stringify(userRes.error, null, 2));
  console.log('getUser data:', JSON.stringify(userRes.data, null, 2));

  const profileRes = await client.from('user_profiles').select('*').eq('id', user.id).single();
  console.log('profile query error:', JSON.stringify(profileRes.error, null, 2));
  console.log('profile query data:', JSON.stringify(profileRes.data, null, 2));
})();
