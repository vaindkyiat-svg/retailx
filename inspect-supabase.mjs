import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const raw = readFileSync('./.env.local', 'utf-8');
const env = {};
for (const line of raw.split(/\r?\n/)) {
  const [key, ...val] = line.split('=');
  if (key && !key.startsWith('#')) env[key] = val.join('=').trim();
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const queryTable = async (table) => {
  const { data, error, status } = await supabase.from(table).select('*').limit(5);
  return { table, status, error, rows: data };
};

const queryCount = async (table) => {
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
  return { table, count, error };
};

const run = async () => {
  console.log('Supabase URL:', env.VITE_SUPABASE_URL);
  console.log('Shop table snapshot:\n');
  const shopRows = await queryTable('shops');
  console.log(JSON.stringify(shopRows, null, 2));

  const tables = ['shops', 'products', 'batches', 'orders', 'refunds', 'drawer_days'];
  for (const table of tables) {
    const count = await queryCount(table);
    console.log(`\ncount(${table}) =`, count.count, 'error=', count.error ? count.error.message : null);
  }

  const { data: userShops, error: userShopsError } = await supabase.from('shops').select('id, shop_name, username, status, plan');
  console.log('\nshops select result error=', userShopsError);
  console.log('shops rows=', JSON.stringify(userShops, null, 2));
};

run().catch(err => { console.error(err); process.exit(1); });
