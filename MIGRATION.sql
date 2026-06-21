-- =====================================================
-- SUPABASE MIGRATION - Add Columns to Shops Table
-- =====================================================
--
-- Run this SQL in Supabase SQL Editor:
-- 1. Go to: https://supabase.com/dashboard/project/xheaeamycsqdwdezrixr/sql
-- 2. Click "New Query"
-- 3. Paste the SQL below
-- 4. Click "Run"
--
-- =====================================================

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

-- Verify columns were added
SELECT column_name FROM information_schema.columns WHERE table_name = 'shops' ORDER BY ordinal_position;
