const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

function readEnv(file) {
  const raw = fs.readFileSync(path.resolve(file), 'utf8');
  return Object.fromEntries(raw.split(/\r?\n/).filter(Boolean).map(l => { const i = l.indexOf('='); return [l.slice(0,i), l.slice(i+1)]; }));
}

(async function(){
  try{
    const env = readEnv('.env.local');
    const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL || env.SUPABASE_URL;
    const key = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
    if(!url || !key){ console.error('Missing SUPABASE URL or SERVICE_ROLE_KEY in .env.local'); process.exit(1); }
    const svc = createClient(url, key);

    // Find a shop to attach the order to
    const shopRes = await svc.from('shops').select('id, shop_name, name').limit(1).maybeSingle();
    const shop = shopRes?.data || shopRes?.id ? shopRes.data : null;
    const shopId = shop?.id || null;

    const now = new Date();
    const orderId = 'ORD-' + String(Date.now()).slice(-4).padStart(4,'0');
    const order = {
      id: orderId,
      shop_id: shopId,
      date: now.toISOString().split('T')[0],
      time: now.toLocaleTimeString('en-GB',{ hour12: false }),
      customer_name: 'Walk-in Customer',
      subtotal: 50,
      discount_type: 'percent',
      discount_value: 0,
      discount_amount: 0,
      total: 50,
      payment_mode: 'Cash',
      status: 'Completed',
    };

    console.log('Inserting order', orderId, 'for shop', shopId);
    const { data: odata, error: oerr } = await svc.from('orders').insert([order]).select();
    console.log('orderErr=', oerr);
    console.log('orderData=', odata);

    const item = {
      id: 'OI-' + Date.now(),
      order_id: orderId,
      product_id: 1,
      name: 'E2E Biscuit packet',
      emoji: '🍪',
      category: 'Sweets & Restaurant',
      price: 50,
      qty: 1,
    };

    const { data: idata, error: ierr } = await svc.from('order_items').insert([item]).select();
    console.log('order_items err=', ierr);
    console.log('order_items data=', idata);

    const tx = {
      id: 'TX-' + Date.now(),
      shop_id: shopId,
      date: order.date,
      time: order.time,
      type: 'sale',
      description: `Sale ${orderId}`,
      amount: order.total,
    };
    const { data: txdata, error: txerr } = await svc.from('drawer_transactions').insert([tx]).select();
    console.log('drawer err=', txerr);
    console.log('drawer data=', txdata);

    // Attempt to decrement batch quantity for product_id=1
    const batchRes = await svc.from('batches').select('*').eq('product_id', 1).limit(1).maybeSingle();
    if(batchRes && batchRes.data){
      const b = batchRes.data;
      const newQty = Math.max(0, (b.quantity || 0) - item.qty);
      const { data: bdata, error: berr } = await svc.from('batches').update({ quantity: newQty }).eq('id', b.id).select();
      console.log('batch update err=', berr);
      console.log('batch update data=', bdata);
    } else {
      console.log('No batch found for product_id=1; skipping batch update');
    }

    console.log('Done');
    process.exit(0);
  }catch(e){
    console.error('Script error', e);
    process.exit(1);
  }
})();
