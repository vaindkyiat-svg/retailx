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
  const anonKey = env.VITE_SUPABASE_ANON_KEY;

  if(!url || !anonKey){ console.error('Missing env'); process.exit(1); }

  const client = createClient(url, anonKey);

  console.log('Signing in as shop owner...');
  const signIn = await client.auth.signInWithPassword({
    email: 'e2e-test-shop+1@example.com',
    password: 'pos@1839'
  });
  if (signIn.error) { console.error('Sign in failed:', signIn.error); process.exit(1); }
  console.log('✓ Signed in:', signIn.data.user.id);

  // Load profile to get shop_id
  const { data: profile } = await client.from('user_profiles').select('*').eq('id', signIn.data.user.id).single();
  const shopId = profile.shop_id;
  console.log('Shop id:', shopId);

  // Fetch a sellable product with a batch
  const { data: products } = await client.from('products').select('*').eq('shop_id', shopId).limit(10);
  if (!products || products.length === 0) { console.error('No products for shop'); process.exit(1); }
  const product = products[0];

  // Fetch batches for product
  const { data: batches } = await client.from('batches').select('*').eq('shop_id', shopId).eq('product_id', product.id).order('added_date', { ascending: true });
  if (!batches || batches.length === 0) { console.error('No batches for product'); process.exit(1); }
  const sellableBatch = batches.find(b => b.status !== 'unsellable' && b.status !== 'expired');
  if (!sellableBatch) { console.error('No sellable batch found'); process.exit(1); }

  // Build order item
  const item = {
    id: product.id,
    name: product.name,
    price: Number(product.price),
    qty: 1,
  };

  const orderId = 'E2E-' + Date.now();
  const todayISO = new Date().toISOString().split('T')[0];
  const nowTime = new Date().toLocaleTimeString('en-GB', { hour12: false });

  const order = {
    id: orderId,
    shop_id: shopId,
    date: todayISO,
    time: nowTime,
    customer_name: 'E2E Customer',
    items_data: [item],
    subtotal: item.price * item.qty,
    discount_type: 'percent',
    discount_value: 0,
    discount_amount: 0,
    total: item.price * item.qty,
    payment_mode: 'Cash',
    status: 'Completed',
  };

  console.log('Inserting order...');
  const { data: insOrder, error: insErr } = await client.from('orders').insert([order]).select();
  if (insErr) { console.error('Order insert failed:', insErr); process.exit(1); }
  console.log('✓ Order inserted id=', insOrder[0].id);

  // Deduct inventory: update first sellable batch quantity
  const qtyToDeduct = item.qty;
  const newQty = Math.max(0, sellableBatch.quantity - qtyToDeduct);
  const { error: updErr } = await client.from('batches').update({ quantity: newQty }).eq('id', sellableBatch.id).eq('shop_id', shopId);
  if (updErr) { console.error('Batch update failed:', updErr); } else { console.log('✓ Batch updated', sellableBatch.id, 'newQty=', newQty); }

  // Ensure today's drawer day exists
  const { data: drawerDayData, error: ddErr } = await client.from('drawer_days').select('*').eq('shop_id', shopId).eq('date', todayISO).maybeSingle();
  let drawerDay = drawerDayData || null;
  if (!drawerDay) {
    const { data: created, error: createErr } = await client.from('drawer_days').insert([{ shop_id: shopId, date: todayISO, opening_balance: 0, closing_balance: null, transactions: [] }]).select();
    if (createErr) {
      console.warn('Could not create drawer_day (RLS or other):', createErr.message);
      drawerDay = null;
    } else {
      drawerDay = created?.[0] || null;
      if (drawerDay) console.log('Created drawer day id=', drawerDay.id);
    }
  }

  if (drawerDay) {
    // Insert drawer transaction
    const tx = {
      shop_id: shopId,
      drawer_day_id: drawerDay.id,
      date: todayISO,
      time: nowTime,
      type: 'sale',
      description: `E2E sale ${orderId}`,
      amount: item.price * item.qty,
      balance: null,
    };
    const { data: txData, error: txErr } = await client.from('drawer_transactions').insert([tx]).select();
    if (txErr) { console.error('Drawer tx insert failed:', txErr); } else { console.log('✓ Drawer tx inserted id=', txData[0].id); }
  } else {
    console.warn('Skipping drawer transaction insert because drawer_day not available.');
  }

  // Verification: fetch latest order, batch, drawer tx
  const { data: orders } = await client.from('orders').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(5);
  console.log('\nRecent orders:', orders.map(o => ({ id: o.id, total: o.total, date: o.date })));

  const { data: batchNow } = await client.from('batches').select('*').eq('id', sellableBatch.id).single();
  console.log('Batch after sale:', { id: batchNow.id, quantity: batchNow.quantity });

  if (drawerDay) {
    const { data: txs } = await client.from('drawer_transactions').select('*').eq('drawer_day_id', drawerDay.id).order('created_at', { ascending: false }).limit(5);
    console.log('Recent drawer txs:', txs.map(t => ({ id: t.id, type: t.type, amount: t.amount })));
  } else {
    console.log('Drawer transactions not available due to missing drawer_day (RLS or not created).');
  }

  const { data: wastage } = await client.from('wastage_entries').select('*').eq('shop_id', shopId).order('created_at', { ascending: false }).limit(5);
  console.log('Recent wastage entries:', (wastage || []).map(w => ({ id: w.id, product_name: w.product_name, quantity: w.quantity, total_loss: w.total_loss })));

  const totalSales = (orders || []).reduce((sum, o) => sum + Number(o.total || 0), 0);
  console.log('Sales summary for recent orders:', { count: orders.length, totalSales });

  console.log('\nE2E checkout simulation complete. Verify the UI reflects these changes.');
  process.exit(0);
})();
