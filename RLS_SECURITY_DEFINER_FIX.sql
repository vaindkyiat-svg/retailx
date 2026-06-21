-- ================================================================
-- RLS POLICY FIX USING SECURITY DEFINER FUNCTION
-- ================================================================
-- 
-- ROOT CAUSE: WITH CHECK clause subqueries can't access other tables
-- in the RLS evaluation context, even though the user has permission.
-- 
-- SOLUTION: Use a SECURITY DEFINER function that bypasses RLS checks
-- to retrieve the user's shop_id.
--
-- HOW TO APPLY:
-- 1. Open https://supabase.com/dashboard/project/xheaeamycsqdwdezrixr/sql
-- 2. Create a new query
-- 3. Copy and paste this entire file
-- 4. Click "Run" to apply
-- 5. After applying, test with scripts/test_rls_fix.cjs
--
-- ================================================================

-- Step 1: Create security definer function to get user's shop_id
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

-- Step 2: Drop old problematic policies on orders table
DROP POLICY IF EXISTS "Shop owners can read their orders" ON public.orders;
DROP POLICY IF EXISTS "Shop owners can insert their orders" ON public.orders;
DROP POLICY IF EXISTS "Shop owners can update their orders" ON public.orders;
DROP POLICY IF EXISTS "Shop owners can delete their orders" ON public.orders;

-- Step 3: Recreate orders policies using the security definer function
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

-- Step 4: Drop old problematic policies on drawer_transactions table
DROP POLICY IF EXISTS "Shop owners can read their drawer transactions" ON public.drawer_transactions;
DROP POLICY IF EXISTS "Shop owners can insert their drawer transactions" ON public.drawer_transactions;
DROP POLICY IF EXISTS "Shop owners can update their drawer transactions" ON public.drawer_transactions;
DROP POLICY IF EXISTS "Shop owners can delete their drawer transactions" ON public.drawer_transactions;

-- Step 5: Recreate drawer_transactions policies using the security definer function
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

-- Step 6: Recreate drawer_days policies using the security definer function
DROP POLICY IF EXISTS "Shop owners can access their drawer days" ON public.drawer_days;
DROP POLICY IF EXISTS "Shop owners can insert their drawer days" ON public.drawer_days;
DROP POLICY IF EXISTS "Shop owners can update their drawer days" ON public.drawer_days;
DROP POLICY IF EXISTS "Shop owners can delete their drawer days" ON public.drawer_days;

CREATE POLICY drawer_days_select ON public.drawer_days
  FOR SELECT
  TO authenticated
  USING (shop_id = public.get_user_shop_id());

CREATE POLICY drawer_days_insert ON public.drawer_days
  FOR INSERT
  TO authenticated
  WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY drawer_days_update ON public.drawer_days
  FOR UPDATE
  TO authenticated
  USING (shop_id = public.get_user_shop_id())
  WITH CHECK (shop_id = public.get_user_shop_id());

CREATE POLICY drawer_days_delete ON public.drawer_days
  FOR DELETE
  TO authenticated
  USING (shop_id = public.get_user_shop_id());

-- ================================================================
-- VERIFICATION QUERIES
-- ================================================================

-- Verify the function exists
SELECT proname, prosecdef FROM pg_proc WHERE proname = 'get_user_shop_id';

-- Verify policies exist
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'orders' ORDER BY policyname;
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'drawer_transactions' ORDER BY policyname;

-- ================================================================
-- TESTING AFTER APPLY
-- ================================================================
-- After applying this SQL, run: node scripts/test_rls_fix.cjs
-- This should show "✓ ORDER INSERT SUCCEEDED!" instead of the RLS error
