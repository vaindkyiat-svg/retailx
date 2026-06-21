-- ================================================================
-- SUPABASE RLS POLICY FIX
-- ================================================================
-- Purpose: Fix row-level security policies that block shop updates
-- Issue: WITH CHECK clause silently rejects UPDATE operations
-- Target: shops and batches tables
-- 
-- Apply using Supabase SQL Editor (dashboard)
-- Run each statement separately if needed
-- ================================================================

-- ========== FIX SHOPS TABLE RLS ==========
-- First, drop the problematic policies
DROP POLICY IF EXISTS "Shop owners can access own shop" ON public.shops;
DROP POLICY IF EXISTS "Shop owners can access own shop by email" ON public.shops;
DROP POLICY IF EXISTS "Admins can manage all shops" ON public.shops;

-- Create corrected policy - simpler condition
CREATE POLICY shop_owner_access ON public.shops
  FOR SELECT
  TO authenticated
  USING (owner_email = auth.email());

CREATE POLICY shop_owner_update ON public.shops
  FOR UPDATE
  TO authenticated
  USING (owner_email = auth.email())
  WITH CHECK (owner_email = auth.email());

CREATE POLICY shop_owner_delete ON public.shops
  FOR DELETE
  TO authenticated
  USING (owner_email = auth.email());

-- ========== FIX BATCHES TABLE RLS ==========
DROP POLICY IF EXISTS "Shop owners can access batches" ON public.batches;
DROP POLICY IF EXISTS "Users can manage batches for their shop" ON public.batches;

CREATE POLICY batch_access ON public.batches
  FOR SELECT
  TO authenticated
  USING (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY batch_insert ON public.batches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY batch_update ON public.batches
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

CREATE POLICY batch_delete ON public.batches
  FOR DELETE
  TO authenticated
  USING (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

-- ========== FIX ORDERS TABLE RLS ==========
DROP POLICY IF EXISTS "Shop owners can access their orders" ON public.orders;

CREATE POLICY order_select ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY order_insert ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY order_update ON public.orders
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

CREATE POLICY order_delete ON public.orders
  FOR DELETE
  TO authenticated
  USING (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

-- ========== FIX DRAWER TRANSACTIONS TABLE RLS ==========
DROP POLICY IF EXISTS "Shop owners can access their drawer transactions" ON public.drawer_transactions;

CREATE POLICY drawer_transactions_select ON public.drawer_transactions
  FOR SELECT
  TO authenticated
  USING (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY drawer_transactions_insert ON public.drawer_transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY drawer_transactions_update ON public.drawer_transactions
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

CREATE POLICY drawer_transactions_delete ON public.drawer_transactions
  FOR DELETE
  TO authenticated
  USING (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );

-- ========== VERIFICATION ==========
-- After applying these changes:
-- 1. Test shop settings update: change owner_name and verify persistence
-- 2. Test batch creation: add batch and verify it appears in database
-- 3. Test checkout: create order and verify it persists

-- Run this query to verify shops policy is working:
-- SELECT id, shop_name, owner_name, owner_email FROM public.shops 
--   WHERE owner_email = 'bb.sweets@gmail.com';
