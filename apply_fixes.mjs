#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const envText = readFileSync('.env.local', 'utf8');
const env = {};
envText.split('\n').forEach(line => {
  const i = line.indexOf('=');
  if (i > 0) env[line.slice(0, i)] = line.slice(i + 1);
});

const client = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function applyRLSFixes() {
  console.log('\n=== APPLYING RLS POLICY FIXES ===\n');
  
  try {
    // Test connection first
    console.log('Testing Supabase connection...');
    const { data, error } = await client
      .from('shops')
      .select('id')
      .eq('id', 'f47ac10b-58cc-4372-a567-0e02b2c3d479')
      .limit(1);
    
    if (error && error.message.includes('401')) {
      console.error('❌ Authentication error - check your keys');
      return;
    }
    
    console.log('✅ Connection successful\n');
    
    // Note about manual application
    console.log('NOTICE: To apply RLS policies, use the Supabase SQL Editor:');
    console.log('1. Go to: https://supabase.com/dashboard/project/xheaeamycsqdwdezrixr/sql');
    console.log('2. Run this SQL:\n');
    
    const sql = `
-- Drop old conflicting policies
DROP POLICY IF EXISTS "Shop owners can access own shop" ON public.shops;
DROP POLICY IF EXISTS "Shop owners can access own shop by email" ON public.shops;

-- Create corrected shop policy
CREATE POLICY "Shop owners can access own shop by email" ON public.shops
  FOR SELECT, UPDATE, DELETE
  TO authenticated
  USING (owner_email = auth.email())
  WITH CHECK (owner_email = auth.email());

-- Fix batches RLS
DROP POLICY IF EXISTS "Shop owners can access batches" ON public.batches;
DROP POLICY IF EXISTS "Users can manage batches for their shop" ON public.batches;

CREATE POLICY "Shop owners can access their batches" ON public.batches
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

CREATE POLICY "Shop owners can read their orders" ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can insert their orders" ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can update their orders" ON public.orders
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

CREATE POLICY "Shop owners can delete their orders" ON public.orders
  FOR DELETE
  TO authenticated
  USING (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

-- Fix drawer transactions RLS
DROP POLICY IF EXISTS "Shop owners can access their drawer transactions" ON public.drawer_transactions;

CREATE POLICY "Shop owners can read their drawer transactions" ON public.drawer_transactions
  FOR SELECT
  TO authenticated
  USING (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can insert their drawer transactions" ON public.drawer_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Shop owners can update their drawer transactions" ON public.drawer_transactions
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

CREATE POLICY "Shop owners can delete their drawer transactions" ON public.drawer_transactions
  FOR DELETE
  TO authenticated
  USING (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );
    `;
    
    console.log(sql);
    console.log('\n=== END NOTICE ===\n');
    
  } catch (err) {
    console.error('Error:', err.message);
  }
}

applyRLSFixes();
