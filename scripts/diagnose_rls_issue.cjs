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
  if(!url || !anonKey){ console.error('Missing env'); process.exit(1); }
  
  const client = createClient(url, anonKey);
  const email = 'e2e-test-shop+1@example.com';
  const password = 'pos@1839';
  
  // Sign in
  const sign = await client.auth.signInWithPassword({ email, password });
  console.log('signErr=', sign.error);
  if(sign.error) process.exit(1);
  
  const uid = sign.data.user.id;
  console.log('User ID:', uid);
  
  // Test 1: Can we read user_profiles directly?
  console.log('\n--- Test 1: Read user_profiles ---');
  const { data: profile, error: profileErr } = await client
    .from('user_profiles')
    .select('*')
    .eq('id', uid)
    .single();
  console.log('profileErr=', profileErr);
  console.log('profile=', profile);
  
  // Test 2: Can we manually check the condition?
  if(profile) {
    console.log('\n--- Test 2: Manual condition check ---');
    console.log('Expected shop_id from profile:', profile.shop_id);
    
    const testOrder = {
      id: 'TEST-' + Date.now(),
      shop_id: profile.shop_id,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
      customer_name: 'Test',
      items_data: [{ name: 'Item', price: 50, qty: 1 }],
      subtotal: 50,
      discount_type: 'percent',
      discount_value: 0,
      discount_amount: 0,
      total: 50,
      payment_mode: 'Cash',
      status: 'Completed',
    };
    
    console.log('Attempting insert with:', testOrder.id, 'for shop:', testOrder.shop_id);
    
    const { data: ins, error: insErr } = await client
      .from('orders')
      .insert([testOrder])
      .select();
    
    console.log('insErr=', insErr);
    console.log('insData=', ins);
    
    // Test 3: Try WITHOUT shop_id constraint (if policy allows)
    if(insErr && insErr.code === '42501') {
      console.log('\n--- Test 3: Checking RLS policy logic ---');
      console.log('The WITH CHECK clause is still blocking.');
      console.log('This might mean:');
      console.log('1. The subquery in WITH CHECK is not finding the profile');
      console.log('2. The subquery is returning NULL');
      console.log('3. The user lacks permission to execute the subquery');
      console.log('');
      console.log('Profile data:', JSON.stringify(profile, null, 2));
    }
  }
})();
