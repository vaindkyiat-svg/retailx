-- Rollback: 20260707110007_rls_skeleton

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public' AND policyname LIKE 'v2_%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
  END LOOP;
END $$;
