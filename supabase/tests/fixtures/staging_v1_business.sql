-- Fixture: V1 business tables for staging cutover simulation
-- Creates minimal V1 schema if not present (additive, non-breaking)

DO $$ BEGIN
  CREATE TYPE public.payment_mode AS ENUM ('Cash', 'UPI', 'Card');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('Completed', 'Pending', 'Cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.batch_status AS ENUM ('active', 'near-expiry', 'unsellable', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.products (
  id BIGSERIAL PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  "nameHi" TEXT,
  category TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  unit TEXT NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  emoji TEXT,
  low_stock_threshold INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id BIGINT NOT NULL REFERENCES public.products (id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  batch_no TEXT NOT NULL,
  mfg_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  quantity INTEGER NOT NULL,
  cost_price DECIMAL(10, 2) NOT NULL,
  added_date DATE NOT NULL,
  status public.batch_status NOT NULL DEFAULT 'active',
  manual_unsellable BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  shop_id UUID NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  items_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal DECIMAL(10, 2) NOT NULL,
  discount_type TEXT NOT NULL DEFAULT 'percent',
  discount_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL,
  payment_mode public.payment_mode NOT NULL,
  status public.order_status NOT NULL DEFAULT 'Completed',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_shop_id ON public.products (shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_shop_id ON public.orders (shop_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON public.orders (date);
CREATE INDEX IF NOT EXISTS idx_batches_shop_id ON public.batches (shop_id);
