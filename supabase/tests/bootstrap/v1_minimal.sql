-- Bootstrap: Minimal V1 tables for Milestone B migration testing
-- NOT a production migration — used by CI and local integration tests only
-- Production Supabase already has these tables from V1 schema

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
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'shop_owner',
  shop_id UUID NOT NULL REFERENCES public.shops (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
