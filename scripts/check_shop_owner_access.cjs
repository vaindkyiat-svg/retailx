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
  const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  const serviceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url || !anonKey || !serviceKey){
    console.error('Missing required env values');
    process.exit(1);
  }
  const anon = createClient(url, anonKey);
  const service = createClient(url, serviceKey);
  const email = 'e2e-test-shop+1@example.com';
  const password = 'pos@1839';
  const { data: signData, error: signErr } = await anon.auth.signInWithPassword({ email, password });
  console.log('signError=', signErr);
  if(signErr){ process.exit(1); }
  const userId = signData?.user?.id || signData?.data?.user?.id;
  const userEmail = signData?.user?.email || signData?.data?.user?.email;
  console.log('userId=', userId, 'email=', userEmail);
  const { data: profile, error: profileErr } = await anon.from('user_profiles').select('*').eq('id', userId).single();
  console.log('profileErr=', profileErr);
  console.log('profile=', profile);
  const shopId = profile?.shop_id;
  console.log('shopId=', shopId);
  const { data: orders, error: ordersErr } = await anon.from('orders').select('*').eq('shop_id', shopId).order('created_at', { ascending: false });
  console.log('ordersErr=', ordersErr);
  console.log('orders count=', orders?.length);
  const { data: shop, error: shopErr } = await anon.from('shops').select('*').eq('id', shopId).single();
  console.log('shopErr=', shopErr);
  console.log('shop=', shop);
  const { data: shops, error: shopsErr } = await anon.from('shops').select('*').limit(5);
  console.log('shopsErr=', shopsErr, 'shops count=', shops?.length);
})();
