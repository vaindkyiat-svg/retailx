-- Rollback: 20260708140000_provision_shop

REVOKE ALL ON FUNCTION public.provision_shop FROM service_role;
DROP FUNCTION IF EXISTS public.provision_shop(
  TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, UUID
);

DROP FUNCTION IF EXISTS private.log_provision_step(UUID, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS private.map_plan_code(TEXT);

DROP POLICY IF EXISTS provisioning_logs_deny_all ON public.provisioning_logs;
DROP POLICY IF EXISTS provisioning_requests_deny_all ON public.provisioning_requests;

DROP INDEX IF EXISTS idx_provisioning_logs_request_id;
DROP INDEX IF EXISTS idx_provisioning_requests_email;

DROP TABLE IF EXISTS public.provisioning_logs;
DROP TABLE IF EXISTS public.provisioning_requests;

-- Restore stub
CREATE OR REPLACE FUNCTION public.provision_shop_stub(
  p_shop_name TEXT,
  p_owner_email TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'provision_shop not implemented — Milestone B database foundation only'
    USING ERRCODE = 'feature_not_supported';
END;
$$;
