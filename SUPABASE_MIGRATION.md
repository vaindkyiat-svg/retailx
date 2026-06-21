# Supabase Schema Migration

To make shop registration and persistence work properly, run the following SQL commands in your Supabase SQL Editor:

## Step 1: Add missing columns to shops table

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

## Step 2: Insert seed shops (demo data)

```sql
INSERT INTO public.shops (
  id, shop_name, name, owner_name, owner_phone, owner_email, address, gst_no,
  city, state, category, username, password, status, plan, registered_on
) VALUES
  ('f47ac10b-58cc-4372-a567-0e02b2c3d479', 'Banke Bihari Sweets & Restaurants', 'Banke Bihari Sweets & Restaurants', 'Gopal Krishna Sharma', '+91 99999 12345', 'bb.sweets@gmail.com', 'Vrindavan, Uttar Pradesh', '09AABCU9603R1ZM', 'Vrindavan', 'Uttar Pradesh', 'Sweets & Restaurant', 'bankebiharipos', 'bihari@123', 'active', 'premium', '2024-01-15'),
  ('a47ac10b-58cc-4372-a567-0e02b2c3d480', 'Sharma General Store', 'Sharma General Store', 'Ramesh Sharma', '+91 98888 54321', 'sharma.store@gmail.com', 'Mathura, Uttar Pradesh', '09BBCDE9501R1ZX', 'Mathura', 'Uttar Pradesh', 'Grocery & General', 'sharmastore', 'sharma@456', 'active', 'standard', '2024-02-20'),
  ('b47ac10b-58cc-4372-a567-0e02b2c3d481', 'Gupta Medical Hall', 'Gupta Medical Hall', 'Suresh Gupta', '+91 97777 11111', 'guptamed@gmail.com', 'Agra, Uttar Pradesh', '09CCDEF9402R1ZY', 'Agra', 'Uttar Pradesh', 'Pharmacy', 'guptamedical', 'gupta@789', 'suspended', 'basic', '2024-03-10'),
  ('c47ac10b-58cc-4372-a567-0e02b2c3d482', 'Patel Farsan & Snacks', 'Patel Farsan & Snacks', 'Dinesh Patel', '+91 96666 22222', 'patelfarsan@gmail.com', 'Surat, Gujarat', '24DDEFG9301R1ZZ', 'Surat', 'Gujarat', 'Namkeen & Snacks', 'patelfarsan', 'patel@321', 'pending', 'basic', '2024-04-05')
ON CONFLICT (id) DO NOTHING;
```

## Step 3: Verify the setup

```sql
-- Check that columns were added
SELECT column_name FROM information_schema.columns WHERE table_name = 'shops' ORDER BY ordinal_position;

-- Check that seed shops were inserted
SELECT id, shop_name, owner_name, username, status FROM public.shops ORDER BY created_at;
```

## Why these changes are needed

The RetailX POS system uses a `RegisteredShop` interface that includes:
- `shopName` - Name of the shop
- `city` - City where shop is located
- `state` - State
- `category` - Shop category (e.g., "Sweets & Restaurant", "Bakery")
- `username` - Login username for shop owner
- `password` - Login password for shop owner
- `status` - Shop status (active/suspended/pending)
- `plan` - Subscription plan (basic/standard/premium)
- `registeredOn` - Registration date

The original schema only had basic shop information. These new fields enable:
- Multi-tenant shop isolation
- Shop-specific user authentication
- Plan-based feature access
- Admin oversight of shop status

## After running the migration

Once the migration is complete:
1. ✅ The application will properly save shops to Supabase when registering new shops
2. ✅ Shops will persist across page reloads
3. ✅ Admin console will display all registered shops
4. ✅ Shop settings changes will be reflected in Supabase
5. ✅ All data (products, orders, inventory) will be properly isolated per shop

## Testing after migration

1. Log in as admin: `bankebiharipos` / `bihari@123`
2. Go to Billing Counter
3. Add products to cart
4. Create an order - verify inventory decreases
5. Log in as different shop owner and verify you only see that shop's data
6. Create a refund - verify inventory restores
7. Check drawer transactions - verify all payment modes are recorded

## Fallback behavior

If Supabase is unavailable or the migration hasn't been run, the system falls back to SEED_SHOPS (demo shops) loaded from the application code. This allows testing without a working Supabase instance.

