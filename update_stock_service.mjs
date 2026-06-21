import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const i = line.indexOf('=');
  if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
});

const service = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: products } = await service.from('products').select('*').eq('shop_id', 'b3a669ce-eee3-4b18-b5ce-6b9685168e27').ilike('name','%Kaju%');
  console.log('products', products);
  if (!products || products.length === 0) return;
  const product = products[0];

  // decrement product.stock by 1
  const newStock = (product.stock || 0) - 1;
  await service.from('products').update({ stock: newStock }).eq('id', product.id).select();

  // find a batch with quantity >0
  const { data: batches } = await service.from('batches').select('*').eq('shop_id','b3a669ce-eee3-4b18-b5ce-6b9685168e27').eq('product_id', product.id);
  console.log('batches', batches);
  if (batches && batches.length>0) {
    const batch = batches[0];
    const newQty = batch.quantity - 1;
    await service.from('batches').update({ quantity: newQty }).eq('id', batch.id).select();
    console.log('Updated batch', batch.id, 'newQty', newQty);
  }

  console.log('Updated product stock to', newStock);
}

run().catch(console.error);
