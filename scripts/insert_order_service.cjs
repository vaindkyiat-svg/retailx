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
    // Prepare items data as JSONB for orders table
    const items = [{ id: 'I-'+Date.now(), product_id: null, name: 'E2E Biscuit packet', emoji: '🍪', category: 'Sweets & Restaurant', price: 50, qty: 1 }];

    // Try to find product id for 'E2E Biscuit'
    const prodRes = await svc.from('products').select('id').ilike('name', '%E2E Biscuit%').limit(1).maybeSingle();
    if (prodRes && prodRes.data) { items[0].product_id = prodRes.data.id; }

    const order = {
      id: orderId,
      shop_id: shopId,
      date: now.toISOString().split('T')[0],
      time: now.toLocaleTimeString('en-GB',{ hour12: false }),
      customer_name: 'Walk-in Customer',
      items_data: items,
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

    // Drawer day: find or create
    const dateStr = order.date;
    let drawerDayId = null;
    const ddRes = await svc.from('drawer_days').select('*').eq('shop_id', shopId).eq('date', dateStr).maybeSingle();
    if (ddRes && ddRes.data) {
      drawerDayId = ddRes.data.id;
    } else {
      const crypto = require('crypto');
      const ddId = crypto.randomUUID();
      const newDD = { id: ddId, shop_id: shopId, date: dateStr, opening_balance: 0, transactions: [] };
      const { data: dddata, error: dderr } = await svc.from('drawer_days').insert([newDD]).select();
      if (dderr) { console.log('drawer_day insert err=', dderr); } else { drawerDayId = dddata && dddata[0] && dddata[0].id; }
    }

    const txId = 'TX-' + Date.now();
    const tx = {
      id: txId,
      shop_id: shopId,
      drawer_day_id: drawerDayId,
      date: order.date,
      time: order.time,
      type: 'sale',
      description: `Sale ${orderId}`,
      amount: order.total,
      balance: order.total,
    };
    const { data: txdata, error: txerr } = await svc.from('drawer_transactions').insert([tx]).select();
    console.log('drawer err=', txerr);
    console.log('drawer data=', txdata);

    // Append transaction to drawer_days.transactions
    if (drawerDayId) {
      const append = [{ id: txId, date: tx.date, time: tx.time, type: tx.type, description: tx.description, amount: tx.amount, balance: tx.balance }];
      const { data: upd, error: updErr } = await svc.from('drawer_days').update({ transactions: append }).eq('id', drawerDayId).select();
      if (updErr) console.log('drawer_days update err', updErr);
      else console.log('drawer_days updated', upd);
    }

    // Decrement batch qty for the product if product_id known
    if (items[0].product_id) {
      const batchRes = await svc.from('batches').select('*').eq('product_id', items[0].product_id).eq('shop_id', shopId).limit(1).maybeSingle();
      if(batchRes && batchRes.data){
        const b = batchRes.data;
        const newQty = Math.max(0, (b.quantity || 0) - items[0].qty);
        const { data: bdata, error: berr } = await svc.from('batches').update({ quantity: newQty }).eq('id', b.id).select();
        console.log('batch update err=', berr);
        console.log('batch update data=', bdata);
      } else {
        console.log('No batch found for product_id', items[0].product_id, '; skipping batch update');
      }
    } else {
      console.log('Product id unknown; skipping batch update');
    }

    console.log('Done');
    process.exit(0);
  }catch(e){
    console.error('Script error', e);
    process.exit(1);
  }
})();
