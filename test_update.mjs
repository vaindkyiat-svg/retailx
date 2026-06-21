import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const i = line.indexOf('=');
  if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
});

const anon = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { 
  auth: { persistSession: false } 
});

async function testUpdate() {
  console.log('\n=== TESTING SHOP UPDATE WITH NEW RLS POLICIES ===\n');
  
  // Sign in as the shop owner
  console.log('1. Signing in as bb.sweets@gmail.com...');
  const { data: authData, error: authError } = await anon.auth.signInWithPassword({
    email: 'bb.sweets@gmail.com',
    password: 'bihari@123'
  });
  
  if (authError) {
    console.log('❌ Sign in failed:', authError.message);
    return;
  }
  
  console.log('✅ Signed in successfully\n');
  
  // Try to update shop name
  console.log('2. Attempting to update shop city...');
  const { data: updateData, error: updateError } = await anon
    .from('shops')
    .update({ city: 'Test City - ' + new Date().toISOString() })
    .eq('id', 'f47ac10b-58cc-4372-a567-0e02b2c3d479')
    .select();
  
  if (updateError) {
    console.log('❌ Update failed:');
    console.log('   Code:', updateError.code);
    console.log('   Message:', updateError.message);
    console.log('   Details:', updateError.details);
  } else {
    console.log('✅ Update returned:', updateData);
  }
  
  // Verify with service role
  console.log('\n3. Verifying update with service role...');
  const service = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: verified } = await service
    .from('shops')
    .select('id,city')
    .eq('id', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');
  
  if (verified && verified[0]) {
    console.log('   Current city:', verified[0].city);
  }
  
  // Sign out
  await anon.auth.signOut();
  console.log('\n=== END TEST ===\n');
}

testUpdate().catch(console.error);
