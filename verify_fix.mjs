import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const i = line.indexOf('=');
  if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
});

const service = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function verify() {
  console.log('\n=== VERIFICATION AFTER RLS FIX ===\n');
  
  // Check shop details
  const { data: shopData } = await service
    .from('shops')
    .select('id,shop_name,owner_name,owner_email,state,city')
    .eq('id', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');
  
  console.log('SHOP DETAILS:');
  if (shopData && shopData[0]) {
    console.log('  Shop Name:', shopData[0].shop_name);
    console.log('  Owner Name:', shopData[0].owner_name);
    console.log('  State:', shopData[0].state);
    console.log('  City:', shopData[0].city);
  }
  
  // Check products
  const { data: products } = await service
    .from('products')
    .select('id,name,price,stock')
    .eq('shop_id', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');
  
  console.log('\nPRODUCTS:');
  console.log('  Count:', products?.length || 0);
  
  // Check batches - THIS IS CRITICAL
  const { data: batches, error: batchError } = await service
    .from('batches')
    .select('id,batch_no,quantity,product_id')
    .eq('shop_id', 'f47ac10b-58cc-4372-a567-0e02b2c3d479');
  
  console.log('\nBATCHES:');
  console.log('  Count:', batches?.length || 0);
  if (batchError) console.log('  Error:', batchError.message);
  
  console.log('\n=== END ===\n');
}

verify().catch(console.error);
