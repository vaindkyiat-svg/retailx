-- Fixture: Corrupted V2 data for health engine tests
-- Run AFTER v1_sample.sql and backfill

-- Shop 4: never backfilled (missing branch, warehouse, subscription, settings)
INSERT INTO public.shops (
  id, name, owner_name, owner_phone, address, plan, status
)
VALUES (
  'a1000000-0000-4000-8000-000000000004',
  'Corrupt Shop',
  'Bad Data',
  '9000000000',
  '1 Broken St',
  'standard',
  'active'
)
ON CONFLICT (id) DO NOTHING;

-- Duplicate default branch on shop 1 (backfill already created MAIN)
INSERT INTO public.branches (shop_id, name, code, is_default, status)
SELECT
  'a1000000-0000-4000-8000-000000000001',
  'Extra Branch',
  'EXTRA',
  true,
  'active'
WHERE NOT EXISTS (
  SELECT 1 FROM public.branches
  WHERE shop_id = 'a1000000-0000-4000-8000-000000000001' AND code = 'EXTRA'
);
