# 🔴 CRITICAL: RLS Policy Blocking Shop Owner Order Creation

## The Problem

Shop owner order insertion is **completely blocked** with error:
```
42501: new row violates row-level security policy for table "orders"
```

### Root Cause Analysis

The RLS INSERT policy uses a subquery to check permissions:
```sql
CREATE POLICY "Shop owners can insert their orders" ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    shop_id = (
      SELECT shop_id FROM public.user_profiles WHERE id = auth.uid()
    )
  );
```

**Problem**: During INSERT, PostgreSQL RLS enforcement runs the WITH CHECK clause in a restricted context where it CANNOT access subqueries across tables, even though the user has read permission on `user_profiles`.

This is a PostgreSQL limitation: RLS checks cannot reference other tables via subqueries in WITH CHECK clauses.

### Evidence

- ✅ User can authenticate successfully
- ✅ User can directly read their own user_profile
- ✅ Profile has correct shop_id
- ❌ INSERT still fails with 42501 (RLS violation)
- ✅ Service-role INSERT works (bypasses RLS)

## The Solution

Use a **SECURITY DEFINER function** instead of inline subqueries. This function runs with the database owner's permissions, bypassing RLS restrictions.

### How to Apply the Fix

**Step 1:** Open your Supabase SQL Editor
- Go to: https://supabase.com/dashboard/project/xheaeamycsqdwdezrixr/sql
- (Or navigate via Dashboard → SQL Editor in your Supabase project)

**Step 2:** Create a new query and paste the contents of:
```
RLS_SECURITY_DEFINER_FIX.sql
```

**Step 3:** Click **"Run"** to apply the SQL

**Step 4:** Verify the fix worked:
```bash
node scripts/test_rls_fix.cjs
```

Expected output:
```
✓ Signed in as shop owner
✓ Profile loaded, shop_id: e62a0254-9b59-4fb6-a7f2-c952221975c8
✓ ORDER INSERT SUCCEEDED!
```

## What the Fix Does

1. **Creates a security definer function** `get_user_shop_id()`
   - Runs with database owner permissions
   - Retrieves the authenticated user's shop_id from user_profiles
   - Can execute subqueries regardless of RLS

2. **Drops old problematic policies** on orders and drawer_transactions

3. **Recreates policies** using the security definer function:
   - SELECT, INSERT, UPDATE, DELETE policies all use `public.get_user_shop_id()`
   - No subqueries in WITH CHECK clauses

## Testing After Fix

### Quick Test
```bash
node scripts/test_rls_fix.cjs
```

### End-to-End Test
1. Open the app at http://localhost:5173
2. Sign in as shop owner (e2e-test-shop+1@example.com / pos@1839)
3. Navigate to POS
4. Create a test order and complete it
5. Verify order appears in Orders section
6. Check database: order should persist after page reload

## Rollback (if needed)

If something goes wrong, revert to subquery policies:
```sql
-- Revert to original (broken) policies
DROP POLICY IF EXISTS order_select ON public.orders;
DROP POLICY IF EXISTS order_insert ON public.orders;
DROP POLICY IF EXISTS order_update ON public.orders;
DROP POLICY IF EXISTS order_delete ON public.orders;

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
```

## Impact on Features

After applying this fix:
- ✅ Shop owners can create orders via POS
- ✅ Shop owners can create drawer transactions
- ✅ All shop-scoped data operations work correctly
- ✅ Service-role operations continue to work
- ✅ RLS still protects data (users only see their own shop data)

## Related Files

- `RLS_SECURITY_DEFINER_FIX.sql` - The fix SQL (apply in Supabase)
- `scripts/test_rls_fix.cjs` - Test script to verify the fix
- `src/lib/database.ts` - Contains order creation functions
- `src/lib/useShopData.ts` - Contains addOrder hook

## Questions?

If the test still fails after applying the SQL:
1. Verify the function was created: Check pg_proc table for `get_user_shop_id`
2. Verify policies were dropped and recreated: Check pg_policies
3. Check browser console for any additional error messages
4. Verify your `.env.local` has correct Supabase credentials

---

**Status**: 🔴 **BLOCKING** - Must fix before shop owner order creation works
