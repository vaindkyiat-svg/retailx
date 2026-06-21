-- Supabase Database Schema for RetailX

-- Create enum types
CREATE TYPE payment_mode AS ENUM ('Cash', 'UPI', 'Card');
CREATE TYPE order_status AS ENUM ('Completed', 'Pending', 'Cancelled');
CREATE TYPE batch_status AS ENUM ('active', 'near-expiry', 'unsellable', 'expired');
CREATE TYPE drawer_tx_type AS ENUM ('opening', 'withdrawal', 'deposit', 'sale', 'refund');
CREATE TYPE wastage_reason AS ENUM ('expired', 'near-expiry-cutoff', 'damaged', 'quality-issue', 'other');

-- Shops table
CREATE TABLE IF NOT EXISTS public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  owner_phone TEXT NOT NULL,
  address TEXT NOT NULL,
  gst_no TEXT,
  owner_email TEXT,
  shop_name TEXT,
  city TEXT,
  state TEXT,
  category TEXT,
  username TEXT UNIQUE,
  password TEXT,
  status TEXT DEFAULT 'active',
  plan TEXT DEFAULT 'standard',
  registered_on TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add missing columns to shops table if they don't exist (migration)
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

-- User profiles table (for authentication/authorization)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'shop_owner',
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE IF EXISTS public.user_profiles
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'shop_owner';

-- Products table
CREATE TABLE IF NOT EXISTS public.products (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  nameHi TEXT,
  category TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  unit TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  emoji TEXT,
  low_stock_threshold INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Batches table
CREATE TABLE IF NOT EXISTS public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  batch_no TEXT NOT NULL,
  mfg_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  quantity INTEGER NOT NULL,
  cost_price DECIMAL(10, 2) NOT NULL,
  added_date DATE NOT NULL,
  status batch_status NOT NULL DEFAULT 'active',
  manual_unsellable BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  items_data JSONB NOT NULL DEFAULT '[]',
  subtotal DECIMAL(10, 2) NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percent',
  discount_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  payment_mode payment_mode NOT NULL,
  status order_status NOT NULL DEFAULT 'Completed',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Refunds table
CREATE TABLE IF NOT EXISTS public.refunds (
  id TEXT PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  order_id TEXT NOT NULL REFERENCES public.orders(id),
  date DATE NOT NULL,
  time TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  refund_mode payment_mode NOT NULL,
  items_data JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Wastage entries table
CREATE TABLE IF NOT EXISTS public.wastage_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  product_id BIGINT NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  product_emoji TEXT,
  category TEXT NOT NULL,
  batch_no TEXT NOT NULL,
  batch_id UUID NOT NULL REFERENCES public.batches(id),
  expiry_date DATE NOT NULL,
  quantity INTEGER NOT NULL,
  cost_price DECIMAL(10, 2) NOT NULL,
  total_loss DECIMAL(10, 2) NOT NULL,
  reason wastage_reason NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Drawer days table
CREATE TABLE IF NOT EXISTS public.drawer_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  opening_balance DECIMAL(10, 2) NOT NULL,
  closing_balance DECIMAL(10, 2),
  transactions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(shop_id, date)
);

-- Drawer transactions table
CREATE TABLE IF NOT EXISTS public.drawer_transactions (
  id TEXT PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  drawer_day_id UUID NOT NULL REFERENCES public.drawer_days(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  type drawer_tx_type NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  balance DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX idx_products_shop_id ON public.products(shop_id);
CREATE INDEX idx_batches_shop_id ON public.batches(shop_id);
CREATE INDEX idx_batches_product_id ON public.batches(product_id);
CREATE INDEX idx_orders_shop_id ON public.orders(shop_id);
CREATE INDEX idx_orders_date ON public.orders(date);
CREATE INDEX idx_refunds_shop_id ON public.refunds(shop_id);
CREATE INDEX idx_wastage_shop_id ON public.wastage_entries(shop_id);
CREATE INDEX idx_wastage_date ON public.wastage_entries(date);
CREATE INDEX idx_drawer_days_shop_id ON public.drawer_days(shop_id);
CREATE INDEX idx_drawer_transactions_drawer_day_id ON public.drawer_transactions(drawer_day_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wastage_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawer_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drawer_transactions ENABLE ROW LEVEL SECURITY;

-- User profiles policies
CREATE POLICY "Users can read their own profile" ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins can manage all profiles" ON public.user_profiles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

-- Shops policies
CREATE POLICY "Admins can manage all shops" ON public.shops
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

CREATE POLICY "Shop owners can access own shop by email" ON public.shops
  FOR SELECT, UPDATE, DELETE
  TO authenticated
  USING (
    owner_email = auth.email()
  )
  WITH CHECK (
    owner_email = auth.email()
  );

-- Shop-owned data policies
CREATE POLICY "Shop owners can access their products" ON public.products
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

CREATE POLICY "Shop owners can access their refunds" ON public.refunds
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

CREATE POLICY "Shop owners can access their wastage entries" ON public.wastage_entries
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

CREATE POLICY "Shop owners can access their drawer days" ON public.drawer_days
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
