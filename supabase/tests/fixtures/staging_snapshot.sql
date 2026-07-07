-- Fixture: Staging production snapshot (representative dataset)
-- Requires: v1_sample.sql + staging_v1_business.sql

-- Products for shop 1
INSERT INTO public.products (shop_id, name, category, price, unit, stock, emoji)
SELECT s.id, p.name, p.category, p.price, p.unit, p.stock, p.emoji
FROM public.shops s
CROSS JOIN (VALUES
  ('Rice 1kg', 'Grains', 55.00, 'kg', 120, '🍚'),
  ('Dal 500g', 'Grains', 80.00, 'pkt', 45, '🫘'),
  ('Milk 1L', 'Dairy', 62.00, 'L', 30, '🥛'),
  ('Bread', 'Bakery', 40.00, 'pc', 20, '🍞'),
  ('Sugar 1kg', 'Grains', 48.00, 'kg', 80, '🧂')
) AS p(name, category, price, unit, stock, emoji)
WHERE s.id = 'a1000000-0000-4000-8000-000000000001'
  AND NOT EXISTS (
    SELECT 1 FROM public.products pr
    WHERE pr.shop_id = s.id AND pr.name = p.name
  );

-- Products for shop 2
INSERT INTO public.products (shop_id, name, category, price, unit, stock, emoji)
SELECT s.id, p.name, p.category, p.price, p.unit, p.stock, p.emoji
FROM public.shops s
CROSS JOIN (VALUES
  ('Premium Olive Oil', 'Gourmet', 450.00, 'L', 15, '🫒'),
  ('Organic Honey', 'Gourmet', 320.00, 'jar', 25, '🍯'),
  ('Artisan Cheese', 'Dairy', 280.00, 'kg', 10, '🧀')
) AS p(name, category, price, unit, stock, emoji)
WHERE s.id = 'a1000000-0000-4000-8000-000000000002'
  AND NOT EXISTS (
    SELECT 1 FROM public.products pr
    WHERE pr.shop_id = s.id AND pr.name = p.name
  );

-- Sample orders shop 1
INSERT INTO public.orders (
  id, shop_id, date, time, customer_name, items_data,
  subtotal, discount_type, discount_value, discount_amount, total,
  payment_mode, status
)
VALUES
  (
    'ORD-SIM-001',
    'a1000000-0000-4000-8000-000000000001',
    CURRENT_DATE - 1,
    '10:30',
    'Walk-in Customer',
    '[{"name":"Rice 1kg","qty":2,"price":55}]'::jsonb,
    110.00, 'percent', 0, 0, 110.00,
    'Cash', 'Completed'
  ),
  (
    'ORD-SIM-002',
    'a1000000-0000-4000-8000-000000000001',
    CURRENT_DATE,
    '14:15',
    'Regular Customer',
    '[{"name":"Milk 1L","qty":1,"price":62},{"name":"Bread","qty":2,"price":40}]'::jsonb,
    142.00, 'percent', 5, 7.10, 134.90,
    'UPI', 'Completed'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.orders (
  id, shop_id, date, time, customer_name, items_data,
  subtotal, discount_type, discount_value, discount_amount, total,
  payment_mode, status
)
VALUES
  (
    'ORD-SIM-003',
    'a1000000-0000-4000-8000-000000000002',
    CURRENT_DATE,
    '11:00',
    'Premium Buyer',
    '[{"name":"Premium Olive Oil","qty":1,"price":450}]'::jsonb,
    450.00, 'percent', 0, 0, 450.00,
    'Card', 'Completed'
  )
ON CONFLICT (id) DO NOTHING;

-- Batch for first product shop 1
INSERT INTO public.batches (
  product_id, shop_id, batch_no, mfg_date, expiry_date,
  quantity, cost_price, added_date, status
)
SELECT
  pr.id,
  pr.shop_id,
  'BATCH-SIM-001',
  CURRENT_DATE - 30,
  CURRENT_DATE + 180,
  100,
  45.00,
  CURRENT_DATE - 30,
  'active'
FROM public.products pr
WHERE pr.shop_id = 'a1000000-0000-4000-8000-000000000001'
  AND pr.name = 'Rice 1kg'
  AND NOT EXISTS (
    SELECT 1 FROM public.batches b
    WHERE b.shop_id = pr.shop_id AND b.batch_no = 'BATCH-SIM-001'
  )
LIMIT 1;
