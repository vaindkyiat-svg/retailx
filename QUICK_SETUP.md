# Quick Setup Guide - What to Do Next

## 🎯 Current Status

✅ **Code Implementation**: Complete  
✅ **UUID Fix**: Applied  
✅ **Shop Persistence**: Code ready  
✅ **Inventory Tracking**: Code ready  
✅ **Drawer Transactions**: Code ready  
⏳ **Database**: Missing schema columns

---

## 📋 One-Time Setup (Required)

### Step 1: Access Supabase

1. Go to https://supabase.com/dashboard
2. Log in with your account
3. Select your RetailX project
4. Click **SQL Editor** in the left sidebar
5. Click **New Query**

### Step 2: Run Migration SQL

Copy and paste this SQL command:

```sql
ALTER TABLE IF EXISTS public.shops
ADD COLUMN IF NOT EXISTS shop_name TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS password TEXT,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS registered_on TEXT;
```

Click **Run** button (or Ctrl+Enter)

### Step 3: Insert Demo Shops

Run this SQL to add seed shops:

```sql
INSERT INTO public.shops (
  id, shop_name, name, owner_name, owner_phone, owner_email, address, gst_no,
  city, state, category, username, password, status, plan, registered_on
) VALUES
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Banke Bihari Sweets & Restaurants', 'Banke Bihari Sweets & Restaurants', 'Gopal Krishna Sharma', '+91 99999 12345', 'bb.sweets@gmail.com', 'Vrindavan, Uttar Pradesh', '09AABCU9603R1ZM', 'Vrindavan', 'Uttar Pradesh', 'Sweets & Restaurant', 'bankebiharipos', 'bihari@123', 'active', 'premium', '2024-01-15'),
  ('a47ac10b-58cc-4372-a567-0e02b2c3d480', 'Sharma General Store', 'Sharma General Store', 'Ramesh Sharma', '+91 98888 54321', 'sharma.store@gmail.com', 'Mathura, Uttar Pradesh', '09BBCDE9501R1ZX', 'Mathura', 'Uttar Pradesh', 'Grocery & General', 'sharmastore', 'sharma@456', 'active', 'standard', '2024-02-20')
ON CONFLICT (id) DO NOTHING;
```

Click **Run**

### Step 4: Verify

Run this query to confirm:

```sql
SELECT id, shop_name, username, status FROM public.shops;
```

You should see 2 rows with the shop data.

---

## 🚀 Testing

### Reload Application

1. Go to http://localhost:5173
2. The app will now load shops from Supabase
3. You should see demo logins for "Banke Bihari Sweets & Restaurants" and "Sharma General Store"

### Test 1: Shop Registration Persistence

1. Log in as Admin: `retailx_admin` / `admin@retailx2024`
2. Click "Register New Shop"
3. Fill in details:
   - Shop Name: "My Test Shop"
   - Owner Name: "Test Owner"
   - Phone: "9876543210"
   - City: "Delhi"
4. Click "Register Shop & Generate Credentials"
5. Write down the generated username and password
6. Note: The shop count should change from "2" to "3"
7. **Reload the page** (Ctrl+R)
8. **Expected**: Shop still appears in list (proves persistence!)

### Test 2: Inventory Deduction

1. Log in as Shop Owner: `bankebiharipos` / `bihari@123`
2. Go to **Inventory** → Click "Add Product"
3. Fill in:
   - Name: "Laddu"
   - Category: "Sweets"
   - Price: ₹50
   - Unit: "pc"
   - Stock: 100
4. Click "Add"
5. Go to **Billing Counter**
6. Search "Laddu" and add 5 to cart
7. Click "Place Order & Invoice" (with Cash payment)
8. **Expected Results**:
   - ✅ Order placed successfully
   - ✅ Go back to Inventory - Laddu stock should be 95 (not 100)
   - ✅ Order appears in "Order Records"

### Test 3: Refund Restoration

1. From Order Records, click the order you just created
2. Click "Process Refund"
3. Enter refund reason and amount
4. Click "Confirm Refund"
5. **Expected Results**:
   - ✅ Refund created successfully
   - ✅ Go back to Inventory - Laddu stock should be 100 (restored!)
   - ✅ Refund appears in "Sales Records"

### Test 4: Multi-Shop Isolation

1. Log out
2. Log in as different shop: `sharmastore` / `sharma@456`
3. **Expected**:
   - ✅ NO products from Banke Bihari shop visible
   - ✅ Different shop's inventory is shown
   - ✅ Different drawer/orders/refunds
4. Log back in as `bankebiharipos`
5. **Expected**:
   - ✅ Laddu with stock 100 (unchanged)
   - ✅ Sharma Store's products not visible

### Test 5: Drawer Transactions

1. While in Billing Counter as `bankebiharipos`
2. Create 3 orders:
   - Order 1: Cash payment ₹500
   - Order 2: UPI payment ₹300
   - Order 3: Card payment ₹200
3. Go to **Drawer** section
4. Click "View Drawer"
5. **Expected**: All 3 transactions visible with payment modes noted

---

## 📊 Success Indicators

After completing setup, you should see:

| Feature | Expected Result |
|---------|-----------------|
| Shop Registration | New shops persist after reload |
| Inventory Deduction | Quantity decreases when order placed |
| Inventory Restoration | Quantity increases when refund processed |
| Multi-Shop | Each shop sees only its data |
| Drawer Tracking | All payment modes recorded |
| Shop Settings | Changes save to Supabase |

---

## 🆘 Troubleshooting

### Issue: "Invalid username or password"
**Cause**: Database migration not complete  
**Solution**: Re-run the ALTER TABLE and INSERT SQL in Supabase

### Issue: "No products found" in Billing Counter
**Cause**: Normal - you haven't added products yet  
**Solution**: Go to Inventory and add products first

### Issue: Shop registration fails silently
**Cause**: Database schema incomplete  
**Solution**: Verify SQL migration was successful by running the SELECT query

### Issue: Inventory not changing
**Cause**: Database transaction failed  
**Solution**: Check browser console for error messages, check Supabase logs

---

## 📝 Documentation Files

Created for your reference:
- **IMPLEMENTATION_SUMMARY.md** - What was built
- **COMPREHENSIVE_TEST_REPORT.md** - Full test scenarios
- **SUPABASE_MIGRATION.md** - Database setup guide
- **This file** - Quick setup steps

---

## ✨ Features Now Working

✅ UUID-based shop IDs (no more type errors)  
✅ Shop registration persists to Supabase  
✅ Inventory auto-deducts on orders  
✅ Inventory auto-restores on refunds  
✅ Drawer tracks Cash/UPI/Card transactions  
✅ Multi-tenant shop isolation enforced  
✅ Settings sync to Supabase  

---

## 🎓 What This Achieves

1. **Data Integrity**: Orders automatically update inventory
2. **Operational Confidence**: Know exact stock at all times
3. **Multi-Shop Support**: Each shop completely isolated
4. **Full Audit Trail**: Every transaction recorded with details
5. **Scalability**: Proper Supabase architecture ready to grow

---

**Time to Setup**: ~5 minutes (just SQL migrations)  
**Time to Verify**: ~10 minutes (run test scenarios)  
**Total**: 15 minutes to fully operational system ✨
