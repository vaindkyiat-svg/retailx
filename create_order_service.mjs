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
  const order = {
    id: 'ORD-' + Math.floor(Math.random()*9000 + 1000),
    shop_id: 'b3a669ce-eee3-4b18-b5ce-6b9685168e27',
    date: new Date().toISOString().slice(0,10),
    time: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    customer_name: 'Walk-in Customer',
    items_data: JSON.stringify([{ product_id: 1, name: 'Kaju Katli (Test)', qty: 1, rate: 240 }]),
    subtotal: 240.00,
    discount_type: 'percent',
    discount_value: 0,
    discount_amount: 0,
    total: 240.00,
    payment_mode: 'Cash'
  };

  const { data, error } = await service.from('orders').insert([order]).select();
  console.log('error', error);
  console.log('data', data);
}

run().catch(console.error);
