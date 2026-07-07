-- Fixture: V1 sample production-like data for Milestone C1 backfill tests
-- Idempotent inserts using fixed UUIDs

INSERT INTO public.shops (
  id, name, owner_name, owner_phone, address, city, state,
  owner_email, plan, status, created_at
)
VALUES
  (
    'a1000000-0000-4000-8000-000000000001',
    'Ankit Grocery',
    'Ankit Kumar',
    '9876543210',
    '12 Market Road',
    'Delhi',
    'Delhi',
    'ankit@example.com',
    'standard',
    'active',
    '2025-01-15T10:00:00Z'
  ),
  (
    'a1000000-0000-4000-8000-000000000002',
    'Premium Foods',
    'Priya Shah',
    '9876543211',
    '45 High Street',
    'Mumbai',
    'Maharashtra',
    'priya@example.com',
    'growth',
    'active',
    '2025-03-20T08:00:00Z'
  ),
  (
    'a1000000-0000-4000-8000-000000000003',
    'Orphan Shop',
    'No Owner Yet',
    '9876543212',
    '99 Empty Lane',
    'Pune',
    'Maharashtra',
    'orphan@example.com',
    'free',
    'active',
    '2025-06-01T12:00:00Z'
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_profiles (id, email, full_name, role, shop_id, created_at)
VALUES
  (
    'b2000000-0000-4000-8000-000000000001',
    'ankit@example.com',
    'Ankit Kumar',
    'shop_owner',
    'a1000000-0000-4000-8000-000000000001',
    '2025-01-15T10:05:00Z'
  ),
  (
    'b2000000-0000-4000-8000-000000000002',
    'priya@example.com',
    'Priya Shah',
    'shop_owner',
    'a1000000-0000-4000-8000-000000000002',
    '2025-03-20T08:05:00Z'
  ),
  (
    'b2000000-0000-4000-8000-000000000003',
    'admin@retailx.com',
    'Platform Admin',
    'admin',
    'a1000000-0000-4000-8000-000000000001',
    '2025-02-01T09:00:00Z'
  )
ON CONFLICT (id) DO NOTHING;
