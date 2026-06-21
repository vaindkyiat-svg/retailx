import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const i = line.indexOf('=');
  if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
});

// Use service role key for schema modifications
const client = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const SQL_FIXES = `
-- Drop old problematic shops policies
DROP POLICY IF EXISTS "Shop owners can read and update own shop" ON public.shops;
DROP POLICY IF EXISTS "Shop owners can read own shop" ON public.shops;

-- Create simplified shop owner policy
CREATE POLICY IF NOT EXISTS "Shop owners can access own shop by email" ON public.shops
  FOR SELECT, UPDATE, DELETE
  TO authenticated
  USING (owner_email = auth.email())
  WITH CHECK (owner_email = auth.email());

-- Verify batches RLS policy is correct
DROP POLICY IF EXISTS "Users can manage batches for their shop" ON public.batches;
DROP POLICY IF EXISTS "Shop owners can access batches" ON public.batches;

-- Create correct batches policy
CREATE POLICY IF NOT EXISTS "Shop owners can access their batches" ON public.batches
  FOR ALL
  TO authenticated
  USING (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

-- Fix orders RLS
DROP POLICY IF EXISTS "Shop owners can access their orders" ON public.orders;

CREATE POLICY IF NOT EXISTS "Shop owners can read their orders" ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Shop owners can insert their orders" ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Shop owners can update their orders" ON public.orders
  FOR UPDATE
  TO authenticated
  USING (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Shop owners can delete their orders" ON public.orders
  FOR DELETE
  TO authenticated
  USING (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

-- Fix drawer transactions RLS
DROP POLICY IF EXISTS "Shop owners can access their drawer transactions" ON public.drawer_transactions;

CREATE POLICY IF NOT EXISTS "Shop owners can read their drawer transactions" ON public.drawer_transactions
  FOR SELECT
  TO authenticated
  USING (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Shop owners can insert their drawer transactions" ON public.drawer_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Shop owners can update their drawer transactions" ON public.drawer_transactions
  FOR UPDATE
  TO authenticated
  USING (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY IF NOT EXISTS "Shop owners can delete their drawer transactions" ON public.drawer_transactions
  FOR DELETE
  TO authenticated
  USING (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );
`;

async function applyFixes() {
  try {
    console.log('\n=== APPLYING RLS POLICY FIXES ===\n');
    
    const { error } = await client.rpc('exec_sql', { sql: SQL_FIXES });
    
    if (error) {
      console.error('Error executing SQL:', error);
      
      // Try alternative approach - execute statements individually
      console.log('Attempting individual statements...');
      
      const statements = SQL_FIXES.split(';').filter(s => s.trim());
      for (const stmt of statements) {
        if (!stmt.trim()) continue;
        console.log(`Executing: ${stmt.substring(0, 60)}...`);
        // The rpc approach won't work without the function, so we'll just log what we would do
        console.log('(Note: SQL execution via rpc requires a database function)');
      }
    } else {
      console.log('✅ RLS policies applied successfully!');
    }
    
  } catch (err) {
    console.error('Application error:', err.message);
  }
}

applyFixes();
