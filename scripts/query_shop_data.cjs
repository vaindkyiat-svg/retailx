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
  const serviceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url || !serviceKey){ console.error('Missing env'); process.exit(1); }
  const svc = createClient(url, serviceKey);
  const shopId = 'e62a0254-9b59-4fb6-a7f2-c952221975c8';
  const { data: products, error: productErr } = await svc.from('products').select('*').eq('shop_id', shopId).order('id',{ascending:true});
  const { data: batches, error: batchErr } = await svc.from('batches').select('*').eq('shop_id', shopId).order('added_date',{ascending:true});
  const { data: orders, error: orderErr } = await svc.from('orders').select('*').eq('shop_id', shopId).order('created_at',{ascending:false});
  console.log('productErr=', productErr);
  console.log('products=', products);
  console.log('batchErr=', batchErr);
  console.log('batches=', batches);
  console.log('orderErr=', orderErr);
  console.log('orders=', orders?.map(o=>({id:o.id, total:o.total, date:o.date, time:o.time})));
})();
