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
  const sign = await client.auth.signInWithPassword({ email, password });
  console.log('signErr=', sign.error);
  if(sign.error) process.exit(1);
  const order = {
    id: 'ORD-TEST-' + Date.now(),
    shop_id: 'e62a0254-9b59-4fb6-a7f2-c952221975c8',
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
    customer_name: 'Test Customer',
    items_data: [{ name: 'Test Item', emoji: '🍪', category: 'Sweets', price: 50, qty: 1 }],
    subtotal: 50,
    discount_type: 'percent',
    discount_value: 0,
    discount_amount: 0,
    total: 50,
    payment_mode: 'Cash',
    status: 'Completed',
  };
  const res = await client.from('orders').insert([order]).select();
  console.log('insertErr=', res.error);
  console.log('insertData=', res.data);
})();
