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
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.VITE_SUPABASE_ANON_KEY;
  
  if(!url || !serviceKey){ console.error('Missing env'); process.exit(1); }
  
  const client = createClient(url, serviceKey);
  
  console.log('Attempting to apply RLS policy fixes via SQL...\n');
  
  const sqlStatements = [
    // Drop existing policies on orders
    `DROP POLICY IF EXISTS "Shop owners can read their orders" ON public.orders;`,
    `DROP POLICY IF EXISTS "Shop owners can insert their orders" ON public.orders;`,
    `DROP POLICY IF EXISTS "Shop owners can update their orders" ON public.orders;`,
    `DROP POLICY IF EXISTS "Shop owners can delete their orders" ON public.orders;`,
    
    // Create new policies with fixed logic
    `CREATE POLICY order_select ON public.orders
      FOR SELECT TO authenticated
      USING (shop_id = (SELECT shop_id FROM user_profiles WHERE id = auth.uid()));`,
    
    `CREATE POLICY order_insert ON public.orders
      FOR INSERT TO authenticated
      WITH CHECK (shop_id = (SELECT shop_id FROM user_profiles WHERE id = auth.uid()));`,
    
    `CREATE POLICY order_update ON public.orders
      FOR UPDATE TO authenticated
      USING (shop_id = (SELECT shop_id FROM user_profiles WHERE id = auth.uid()))
      WITH CHECK (shop_id = (SELECT shop_id FROM user_profiles WHERE id = auth.uid()));`,
    
    `CREATE POLICY order_delete ON public.orders
      FOR DELETE TO authenticated
      USING (shop_id = (SELECT shop_id FROM user_profiles WHERE id = auth.uid()));`,
  ];
  
  // Try to execute each statement via rpc
  for (const sql of sqlStatements) {
    try {
      const { data, error } = await client.rpc('exec', { sql });
      if (error) {
        console.log('❌ RPC exec not available:', error.message.slice(0, 100));
        throw new Error('RPC exec not available');
      }
      console.log('✓ Applied:', sql.slice(0, 60));
    } catch (err) {
      console.log('⚠ Could not apply via RPC - SQL functions not available');
      console.log('Please manually run this SQL in your Supabase dashboard:\n');
      console.log(sqlStatements.join('\n\n'));
      break;
    }
  }
})();
