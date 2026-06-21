# Supabase Integration Implementation Guide

This guide helps you complete the Supabase integration for the RetailX application.

## Overview

Your application has been partially upgraded to use Supabase. This document guides you through:
1. Remaining code updates needed
2. Field name mappings
3. Testing the integration
4. Troubleshooting

## Step 1: Environment Setup

### 1.1 Create `.env.local` file

Create a file named `.env.local` in your project root:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_PUBLIC_KEY
```

**How to get these values:**
1. Go to your Supabase project dashboard
2. Click **Settings** → **API**
3. Copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Anon Public Key** → `VITE_SUPABASE_ANON_KEY`

## Step 2: Create Supabase Database

### 2.1 Using Supabase Dashboard

1. Open your Supabase project
2. Go to **SQL Editor**
3. Click **New Query**
4. Open `src/lib/schema.sql` from your project
5. Copy the entire SQL content
6. Paste into Supabase SQL Editor
7. Click **Run**

### 2.2 Verify Schema Creation

After running the SQL, verify by going to **Database** → **Tables** and checking:
- ✅ shops
- ✅ products
- ✅ batches
- ✅ orders
- ✅ refunds
- ✅ wastage_entries
- ✅ drawer_days
- ✅ drawer_transactions

## Step 3: Install Dependencies

```bash
cd /path/to/retailx1
pnpm install
```

This installs the Supabase client library.

## Step 4: Update App.tsx Field Names

The database uses snake_case column names, but your UI code uses camelCase. You need to update specific fields in App.tsx:

### Field Mapping Reference

| Old (camelCase) | New (snake_case) | Type |
|-----------------|------------------|------|
| `order.customerName` | `order.customer_name` | string |
| `order.paymentMode` | `order.payment_mode` | string |
| `order.discountType` | `order.discount_type` | string |
| `order.discountValue` | `order.discount_value` | number |
| `order.discountAmount` | `order.discount_amount` | number |
| `refund.customername` | `refund.customer_name` | string |
| `refund.orderId` | `refund.order_id` | string |
| `refund.refundMode` | `refund.refund_mode` | string |
| `batch.batchNo` | `batch.batch_no` | string |
| `batch.mfgDate` | `batch.mfg_date` | string |
| `batch.expiryDate` | `batch.expiry_date` | string |
| `batch.costPrice` | `batch.cost_price` | number |
| `batch.manualUnsellable` | `batch.manual_unsellable` | boolean |
| `drawer.closingBalance` | `drawer.closing_balance` | number |
| `drawer.openingBalance` | `drawer.opening_balance` | number |
| `wastage.productId` | `wastage.product_id` | number |
| `wastage.productEmoji` | `wastage.product_emoji` | string |
| `wastage.batchNo` | `wastage.batch_no` | string |
| `wastage.batchId` | `wastage.batch_id` | string |
| `wastage.expiryDate` | `wastage.expiry_date` | string |
| `wastage.costPrice` | `wastage.cost_price` | number |
| `wastage.totalLoss` | `wastage.total_loss` | number |
| `product.lowStockThreshold` | `product.low_stock_threshold` | number |

### Quick Search and Replace in VS Code

1. Press **Ctrl+H** (or **Cmd+H** on Mac) to open Find and Replace
2. Enable "Regex" option (click `.*` button)
3. Use the replacements below:

#### Replace 1: customerName
```
Find: \.customerName
Replace: .customer_name
```

#### Replace 2: paymentMode
```
Find: \.paymentMode
Replace: .payment_mode
```

#### Replace 3: discountType
```
Find: \.discountType
Replace: .discount_type
```

#### Replace 4: discountValue
```
Find: \.discountValue
Replace: .discount_value
```

#### Replace 5: discountAmount
```
Find: \.discountAmount
Replace: .discount_amount
```

#### Replace 6: orderId
```
Find: \.orderId
Replace: .order_id
```

#### Replace 7: refundMode
```
Find: \.refundMode
Replace: .refund_mode
```

#### Replace 8: batchNo
```
Find: \.batchNo
Replace: .batch_no
```

#### Replace 9: mfgDate
```
Find: \.mfgDate
Replace: .mfg_date
```

#### Replace 10: expiryDate
```
Find: \.expiryDate
Replace: .expiry_date
```

#### Replace 11: costPrice
```
Find: \.costPrice
Replace: .cost_price
```

#### Replace 12: manualUnsellable
```
Find: \.manualUnsellable
Replace: .manual_unsellable
```

#### Replace 13: closingBalance
```
Find: \.closingBalance
Replace: .closing_balance
```

#### Replace 14: openingBalance
```
Find: \.openingBalance
Replace: .opening_balance
```

#### Replace 15: productId
```
Find: \.productId
Replace: .product_id
```

#### Replace 16: productEmoji
```
Find: \.productEmoji
Replace: .product_emoji
```

#### Replace 17: totalLoss
```
Find: \.totalLoss
Replace: .total_loss
```

#### Replace 18: lowStockThreshold
```
Find: \.lowStockThreshold
Replace: .low_stock_threshold
```

## Step 5: Update DrawerDay Field Access

The drawer structure has changed. Update references from:

```javascript
// Old
drawerDay.transactions.reduce((s, t) => s + t.amount, 0)
drawerDay.closingBalance

// New
drawerDay.transactions.reduce((s, t) => s + t.amount, 0)
drawerDay.closing_balance
```

## Step 6: Test the Integration

### 6.1 Start Development Server

```bash
pnpm dev
```

### 6.2 Check for Errors

1. Open browser console (F12)
2. Look for any error messages
3. Check:
   - "Missing Supabase environment variables" → Fix `.env.local`
   - Network errors → Check Supabase URL
   - Type errors → Verify field names

### 6.3 Verify Data Persistence

1. Add a product in the app
2. Refresh the page
3. Verify the product still exists
4. Check Supabase dashboard → Table Editor → products table

## Step 7: Disable RLS (Testing Only)

If you encounter permission errors during testing:

1. Go to Supabase SQL Editor
2. Run this:

```sql
ALTER TABLE public.shops DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.wastage_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawer_days DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawer_transactions DISABLE ROW LEVEL SECURITY;
```

**⚠️ WARNING:** Only for development/testing. Enable RLS before production.

## Step 8: Add Initial Shop Data

If you want to test with data:

### Option A: Using Supabase Dashboard

1. Go to **Table Editor**
2. Click **shops** table
3. Click **Insert row**
4. Add:
   ```
   name: "Test Store"
   owner_name: "John Doe"
   owner_phone: "9876543210"
   address: "123 Main St"
   gst_no: "18AABCT0055K1Z0"
   owner_email: "john@example.com"
   ```
5. Click **Save**

### Option B: Using SQL

```sql
INSERT INTO public.shops (name, owner_name, owner_phone, address, gst_no, owner_email)
VALUES (
  'Test Store',
  'John Doe',
  '9876543210',
  '123 Main Street',
  '18AABCT0055K1Z0',
  'john@example.com'
);
```

## Step 9: Verify Setup

Check that your app:
- ✅ Loads without console errors
- ✅ Displays the shop dropdown
- ✅ Can add products
- ✅ Can create orders
- ✅ Data persists after page refresh
- ✅ Data appears in Supabase dashboard

## Troubleshooting

### Issue: "Missing Supabase environment variables"
```
Solution:
1. Create .env.local with correct variables
2. Restart dev server (pnpm dev)
3. Clear browser cache
```

### Issue: "Connection error" or "Failed to load"
```
Solution:
1. Verify VITE_SUPABASE_URL is correct (check for typos)
2. Verify VITE_SUPABASE_ANON_KEY is correct
3. Check that Supabase project is not paused
4. Open browser DevTools → Network tab to see actual error
```

### Issue: "relation 'products' does not exist"
```
Solution:
1. Go to Supabase SQL Editor
2. Run the SQL from src/lib/schema.sql again
3. Check for error messages in the output
4. Verify all tables appear in Database → Tables
```

### Issue: "permission denied for schema public"
```
Solution:
Disable RLS (see Step 7) for development/testing
```

### Issue: Data not persisting
```
Solution:
1. Check Supabase Dashboard → Logs for errors
2. Open browser DevTools → Network tab
3. Look for failed API requests
4. Check that you're not getting 401 Unauthorized errors
```

### Issue: TypeError about field names
```
Solution:
1. Search and replace field names (Step 4)
2. Use the mapping reference above
3. Check App.tsx for any remaining camelCase database field names
```

## Performance Monitoring

### Monitor API Usage

1. Go to Supabase Dashboard
2. Navigate to **API** section
3. Check:
   - Request count
   - Request latency
   - Error rate

### Check Database Size

1. Go to **Database** → **Overview**
2. See storage usage
3. Monitor if approaching free tier limits

## Next Steps (After Basic Testing)

1. **Implement Authentication** - Add Supabase Auth
2. **Enable RLS** - Implement security policies
3. **Add Real-time** - Use Supabase subscriptions
4. **Set up Backups** - Configure automatic backups
5. **Monitor Performance** - Set up alerts
6. **Plan for Growth** - Consider upgrade paths

## Files Reference

| File | Purpose |
|------|---------|
| `.env.local` | Supabase credentials (local only) |
| `src/lib/supabase.ts` | Supabase client initialization |
| `src/lib/database.ts` | Database API functions |
| `src/lib/useShopData.ts` | React hook for data management |
| `src/lib/schema.sql` | Database schema definition |
| `src/lib/typeConverters.ts` | Type conversion helpers |
| `src/app/App.tsx` | Main app (updated) |
| `package.json` | Dependencies (updated) |

## Getting Help

- **Supabase Documentation**: https://supabase.com/docs
- **Check Supabase Logs**: Dashboard → Logs tab
- **Check App Errors**: Browser DevTools (F12) → Console tab
- **Database Issues**: Supabase Dashboard → SQL Editor → Logs

## Important Notes

- ⚠️ Do NOT commit `.env.local` to git - add to `.gitignore`
- ⚠️ Keep your Anon Key confidential
- ⚠️ Enable RLS before going to production
- ✅ Always test database changes in development first
- ✅ Monitor your Supabase usage to stay within free tier
- ✅ Set up backups before storing critical data
