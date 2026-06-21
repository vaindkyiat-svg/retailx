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
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  
  if(!url || !anonKey){ console.error('Missing env'); process.exit(1); }
  
  // Use anon client to test as shop owner
  const anonClient = createClient(url, anonKey);
  
  console.log('=== TESTING RLS POLICY FIX WITH SECURITY DEFINER ===\n');
  
  // Sign in as shop owner
  const signIn = await anonClient.auth.signInWithPassword({
    email: 'e2e-test-shop+1@example.com',
    password: 'pos@1839'
  });
  
  if (signIn.error) {
    console.error('Sign in failed:', signIn.error);
    process.exit(1);
  }
  
  console.log('✓ Signed in as shop owner');
  
  // Get profile to confirm shop_id
  const { data: profile } = await anonClient
    .from('user_profiles')
    .select('*')
    .eq('id', signIn.data.user.id)
    .single();
  
  console.log('✓ Profile loaded, shop_id:', profile.shop_id);
  
  // Now test order insertion
  const testOrder = {
    id: 'TEST-DEFINER-' + Date.now(),
    shop_id: profile.shop_id,
    date: new Date().toISOString().split('T')[0],
    time: new Date().toLocaleTimeString('en-GB', { hour12: false }),
    customer_name: 'Test Customer',
    items_data: [{ name: 'Test Item', price: 50, qty: 1 }],
    subtotal: 50,
    discount_type: 'percent',
    discount_value: 0,
    discount_amount: 0,
    total: 50,
    payment_mode: 'Cash',
    status: 'Completed',
  };
  
  console.log('\nAttempting order insert...');
  const { data: ins, error: insErr } = await anonClient
    .from('orders')
    .insert([testOrder])
    .select();
  
  if (insErr) {
    console.log('❌ INSERT FAILED with error:', insErr.code);
    console.log('   Message:', insErr.message);
    console.log('\nThis confirms the WITH CHECK clause in RLS is blocking INSERT.');
    console.log('\n=== FIX REQUIRED ===');
    console.log('The policy needs to use a SECURITY DEFINER function instead of inline subquery.');
    console.log('\nYou must apply this SQL in your Supabase dashboard SQL editor:');
    console.log(`
-- Create security definer function to get user's shop_id
CREATE OR REPLACE FUNCTION public.get_user_shop_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  shop_id UUID;
BEGIN
  SELECT user_profiles.shop_id INTO shop_id
  FROM user_profiles
  WHERE user_profiles.id = auth.uid()
  LIMIT 1;
  RETURN shop_id;
END;
$$;

-- Drop problematic policies
DROP POLICY IF EXISTS "Shop owners can read their orders" ON public.orders;
DROP POLICY IF EXISTS "Shop owners can insert their orders" ON public.orders;
DROP POLICY IF EXISTS "Shop owners can update their orders" ON public.orders;
DROP POLICY IF EXISTS "Shop owners can delete their orders" ON public.orders;

-- Recreate policies using the security definer function
CREATE POLICY order_select ON public.orders
  FOR SELECT
  TO authenticated
  USING (shop_id = public.get_user_shop_id());

CREATE POLICY order_insert ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY order_update ON public.orders
  FOR UPDATE
  TO authenticated
  USING (shop_id = public.get_user_shop_id())
  WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY order_delete ON public.orders
  FOR DELETE
  TO authenticated
  USING (shop_id = public.get_user_shop_id());

-- Do the same for drawer_transactions
DROP POLICY IF EXISTS "Shop owners can read their drawer transactions" ON public.drawer_transactions;
DROP POLICY IF EXISTS "Shop owners can insert their drawer transactions" ON public.drawer_transactions;
DROP POLICY IF EXISTS "Shop owners can update their drawer transactions" ON public.drawer_transactions;
DROP POLICY IF EXISTS "Shop owners can delete their drawer transactions" ON public.drawer_transactions;

CREATE POLICY drawer_select ON public.drawer_transactions
  FOR SELECT
  TO authenticated
  USING (shop_id = public.get_user_shop_id());

CREATE POLICY drawer_insert ON public.drawer_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY drawer_update ON public.drawer_transactions
  FOR UPDATE
  TO authenticated
  USING (shop_id = public.get_user_shop_id())
  WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY drawer_delete ON public.drawer_transactions
  FOR DELETE
  TO authenticated
  USING (shop_id = public.get_user_shop_id());
    `);
  } else {
    console.log('✓ ORDER INSERT SUCCEEDED!');
    console.log('Order ID:', ins[0].id);
    console.log('\n✅ RLS POLICY IS NOW WORKING');
  }
})();
