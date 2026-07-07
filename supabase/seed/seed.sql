-- Master seed runner — executes all seeds in order
-- Usage: psql $DATABASE_URL -f supabase/seed/seed.sql

\echo 'Seeding roles...'
\ir 01_roles.sql

\echo 'Seeding permissions...'
\ir 02_permissions.sql

\echo 'Seeding role_permissions...'
\ir 03_role_permissions.sql

\echo 'Seeding plans...'
\ir 04_plans.sql

\echo 'Seeding system settings...'
\ir 05_system_settings.sql

\echo 'Seeding feature flags...'
\ir 06_feature_flags.sql

\echo 'Seed complete.'
