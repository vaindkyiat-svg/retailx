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

async function testBatchInsert() {
  console.log('\n=== TESTING BATCH INSERT WITH NEW RLS POLICIES ===\n');
  
  // Sign in
  console.log('1. Signing in...');
  const { error: authError } = await anon.auth.signInWithPassword({
    email: 'bb.sweets@gmail.com',
    password: 'bihari@123'
  });
  
  if (authError) {
    console.log('❌ Sign in failed:', authError.message);
    return;
  }
  
  console.log('✅ Signed in\n');
  
  // Get a product ID first
  console.log('2. Fetching product...');
  const { data: products, error: productError } = await anon
    .from('products')
    .select('id')
    .eq('shop_id', 'f47ac10b-58cc-4372-a567-0e02b2c3d479')
    .limit(1);
  
  if (productError || !products || products.length === 0) {
    console.log('❌ Could not fetch product');
    return;
  }
  
  const productId = products[0].id;
  console.log('✅ Using product ID:', productId, '\n');
  
  // Try to insert a batch
  console.log('3. Attempting to insert batch...');
  const batchData = {
    product_id: productId,
    shop_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    batch_no: 'TEST-BATCH-' + Date.now(),
    mfg_date: '2026-06-21',
    expiry_date: '2026-12-21',
    quantity: 100,
    cost_price: 150.00,
    added_date: '2026-06-21',
    status: 'active',
    notes: 'Test batch to verify RLS fix'
  };
  
  const { data: batchResult, error: batchError } = await anon
    .from('batches')
    .insert([batchData])
    .select();
  
  if (batchError) {
    console.log('❌ Batch insert failed:');
    console.log('   Code:', batchError.code);
    console.log('   Message:', batchError.message);
    console.log('   Details:', batchError.details);
  } else {
    console.log('✅ Batch insert succeeded!');
    console.log('   Inserted:', batchResult);
  }
  
  // Verify with service role
  console.log('\n4. Verifying with service role...');
  const service = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: batches } = await service
    .from('batches')
    .select('id,batch_no,quantity')
    .eq('shop_id', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');
  
  console.log('   Total batches in shop:', batches?.length || 0);
  if (batches && batches.length > 0) {
    batches.forEach(b => {
      console.log('   - Batch', b.batch_no, ':', b.quantity, 'units');
    });
  }
  
  // Sign out
  await anon.auth.signOut();
  console.log('\n=== END TEST ===\n');
}

testBatchInsert().catch(console.error);
