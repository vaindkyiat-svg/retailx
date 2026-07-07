-- Migration: 20260708140000_provision_shop
-- RetailX V2 Sprint E1 — Shop provisioning engine

-- ─── Idempotency + logging tables ───
CREATE TABLE IF NOT EXISTS public.provisioning_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT NOT NULL,
  owner_email TEXT NOT NULL,
  shop_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'rolled_back')),
  result JSONB,
  error_code TEXT,
  error_detail TEXT,
  provisioned_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT provisioning_requests_idempotency_unique UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_provisioning_requests_email
  ON public.provisioning_requests (lower(owner_email));

CREATE TABLE IF NOT EXISTS public.provisioning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.provisioning_requests (id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started', 'completed', 'failed', 'skipped')),
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_provisioning_logs_request_id
  ON public.provisioning_logs (request_id);

COMMENT ON TABLE public.provisioning_requests IS
  'Sprint E1 idempotent shop provisioning requests.';
COMMENT ON TABLE public.provisioning_logs IS
  'Sprint E1 step-by-step provisioning audit trail.';

ALTER TABLE public.provisioning_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provisioning_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY provisioning_requests_deny_all ON public.provisioning_requests
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

CREATE POLICY provisioning_logs_deny_all ON public.provisioning_logs
  FOR ALL TO authenticated, anon USING (false) WITH CHECK (false);

-- ─── Helper: map legacy plan text to V2 plan code ───
CREATE OR REPLACE FUNCTION private.map_plan_code(p_plan TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_normalized TEXT := lower(trim(coalesce(p_plan, 'standard')));
BEGIN
  RETURN CASE v_normalized
    WHEN 'free' THEN 'free'
    WHEN 'starter' THEN 'starter'
    WHEN 'standard' THEN 'starter'
    WHEN 'basic' THEN 'starter'
    WHEN 'growth' THEN 'growth'
    WHEN 'pro' THEN 'growth'
    WHEN 'premium' THEN 'growth'
    WHEN 'enterprise' THEN 'enterprise'
    ELSE 'starter'
  END;
END;
$$;

-- ─── Helper: log provisioning step ───
CREATE OR REPLACE FUNCTION private.log_provision_step(
  p_request_id UUID,
  p_step TEXT,
  p_status TEXT,
  p_detail JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.provisioning_logs (request_id, step, status, detail)
  VALUES (p_request_id, p_step, p_status, p_detail);
END;
$$;

-- ─── Core provisioning RPC (transactional) ───
CREATE OR REPLACE FUNCTION public.provision_shop(
  p_idempotency_key TEXT,
  p_user_id UUID,
  p_owner_email TEXT,
  p_owner_name TEXT,
  p_owner_phone TEXT,
  p_shop_name TEXT,
  p_address TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_gst_no TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_plan_code TEXT DEFAULT 'starter',
  p_timezone TEXT DEFAULT 'Asia/Kolkata',
  p_currency TEXT DEFAULT 'INR',
  p_username TEXT DEFAULT NULL,
  p_password TEXT DEFAULT NULL,
  p_write_legacy_credentials BOOLEAN DEFAULT true,
  p_use_invitation BOOLEAN DEFAULT false,
  p_provisioned_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id UUID;
  v_existing JSONB;
  v_shop_id UUID;
  v_membership_id UUID;
  v_branch_id UUID;
  v_warehouse_id UUID;
  v_subscription_id UUID;
  v_role_id UUID;
  v_plan_id UUID;
  v_plan_mapped TEXT;
  v_address TEXT;
  v_invitation_id UUID;
  v_result JSONB;
BEGIN
  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'PROVISION_FAILED: idempotency_key required';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'PROVISION_FAILED: user_id required';
  END IF;

  IF p_owner_email IS NULL OR length(trim(p_owner_email)) = 0 THEN
    RAISE EXCEPTION 'PROVISION_FAILED: owner_email required';
  END IF;

  IF p_shop_name IS NULL OR length(trim(p_shop_name)) = 0 THEN
    RAISE EXCEPTION 'PROVISION_FAILED: shop_name required';
  END IF;

  -- Idempotent replay
  SELECT result INTO v_existing
  FROM public.provisioning_requests
  WHERE idempotency_key = p_idempotency_key AND status = 'completed';

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Duplicate email (existing profile)
  IF EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE lower(email) = lower(trim(p_owner_email)) AND id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'EMAIL_ALREADY_EXISTS: %', lower(trim(p_owner_email));
  END IF;

  -- Duplicate shop name for same owner email
  IF EXISTS (
    SELECT 1 FROM public.shops
    WHERE lower(owner_email) = lower(trim(p_owner_email))
      AND lower(coalesce(shop_name, name)) = lower(trim(p_shop_name))
  ) THEN
    RAISE EXCEPTION 'SHOP_ALREADY_EXISTS: %', trim(p_shop_name);
  END IF;

  v_plan_mapped := private.map_plan_code(p_plan_code);

  SELECT id INTO v_plan_id FROM public.plans WHERE code = v_plan_mapped AND is_active = true LIMIT 1;
  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_PLAN: %', p_plan_code;
  END IF;

  SELECT id INTO v_role_id FROM public.system_roles WHERE slug = 'shop_owner' LIMIT 1;
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'PROVISION_FAILED: shop_owner role missing — run seeds';
  END IF;

  INSERT INTO public.provisioning_requests (
    idempotency_key, owner_email, shop_name, status, provisioned_by
  ) VALUES (
    p_idempotency_key, lower(trim(p_owner_email)), trim(p_shop_name), 'pending', p_provisioned_by
  )
  ON CONFLICT (idempotency_key) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_request_id;

  PERFORM private.log_provision_step(v_request_id, 'validate_input', 'completed', '{}'::jsonb);

  v_address := coalesce(nullif(trim(p_address), ''), concat_ws(', ', nullif(trim(p_city), ''), nullif(trim(p_state), '')));
  v_shop_id := gen_random_uuid();

  -- ─── Create shop ───
  PERFORM private.log_provision_step(v_request_id, 'create_shop', 'started', jsonb_build_object('shop_id', v_shop_id));

  INSERT INTO public.shops (
    id, name, shop_name, owner_name, owner_phone, owner_email,
    address, city, state, category, gst_no,
    username, password, status, plan, registered_on
  ) VALUES (
    v_shop_id,
    trim(p_shop_name),
    trim(p_shop_name),
    trim(p_owner_name),
    trim(p_owner_phone),
    lower(trim(p_owner_email)),
    v_address,
    nullif(trim(p_city), ''),
    nullif(trim(p_state), ''),
    nullif(trim(p_category), ''),
    nullif(trim(p_gst_no), ''),
    CASE WHEN p_write_legacy_credentials THEN coalesce(p_username, lower(regexp_replace(trim(p_shop_name), '[^a-zA-Z0-9]', '', 'g'))) END,
    CASE WHEN p_write_legacy_credentials THEN p_password END,
    'active',
    v_plan_mapped,
    to_char(now() AT TIME ZONE coalesce(p_timezone, 'Asia/Kolkata'), 'YYYY-MM-DD')
  );

  PERFORM private.log_provision_step(v_request_id, 'create_shop', 'completed', jsonb_build_object('shop_id', v_shop_id));

  -- ─── User profile ───
  PERFORM private.log_provision_step(v_request_id, 'create_profile', 'started', '{}'::jsonb);

  INSERT INTO public.user_profiles (id, email, full_name, role, shop_id)
  VALUES (p_user_id, lower(trim(p_owner_email)), trim(p_owner_name), 'shop_owner', v_shop_id)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    shop_id = EXCLUDED.shop_id;

  PERFORM private.log_provision_step(v_request_id, 'create_profile', 'completed', jsonb_build_object('user_id', p_user_id));

  -- ─── Membership ───
  PERFORM private.log_provision_step(v_request_id, 'create_membership', 'started', '{}'::jsonb);

  INSERT INTO public.memberships (user_id, shop_id, role_id, status, is_primary, joined_at)
  VALUES (p_user_id, v_shop_id, v_role_id, 'active', true, now())
  RETURNING id INTO v_membership_id;

  PERFORM private.log_provision_step(v_request_id, 'create_membership', 'completed', jsonb_build_object('membership_id', v_membership_id));

  -- ─── Default branch ───
  PERFORM private.log_provision_step(v_request_id, 'create_branch', 'started', '{}'::jsonb);

  INSERT INTO public.branches (shop_id, name, code, address, city, state, phone, status, is_default)
  VALUES (v_shop_id, 'Main', 'MAIN', v_address, nullif(trim(p_city), ''), nullif(trim(p_state), ''), trim(p_owner_phone), 'active', true)
  RETURNING id INTO v_branch_id;

  PERFORM private.log_provision_step(v_request_id, 'create_branch', 'completed', jsonb_build_object('branch_id', v_branch_id));

  -- ─── Default warehouse ───
  PERFORM private.log_provision_step(v_request_id, 'create_warehouse', 'started', '{}'::jsonb);

  INSERT INTO public.warehouses (shop_id, branch_id, name, code, status, is_default)
  VALUES (v_shop_id, v_branch_id, 'Default', 'DEFAULT', 'active', true)
  RETURNING id INTO v_warehouse_id;

  PERFORM private.log_provision_step(v_request_id, 'create_warehouse', 'completed', jsonb_build_object('warehouse_id', v_warehouse_id));

  -- ─── Shop settings ───
  PERFORM private.log_provision_step(v_request_id, 'create_settings', 'started', '{}'::jsonb);

  INSERT INTO public.shop_settings (shop_id, key, value) VALUES
    (v_shop_id, 'pos.currency_default', to_jsonb(p_currency)),
    (v_shop_id, 'pos.tax_rate_default', '0'::jsonb),
    (v_shop_id, 'pos.receipt_footer', '""'::jsonb),
    (v_shop_id, 'onboarding.completed', 'false'::jsonb),
    (v_shop_id, 'legacy.plan_source', '"provision_shop"'::jsonb),
    (v_shop_id, 'shop.timezone', to_jsonb(p_timezone)),
    (v_shop_id, 'onboarding.v2_provisioned', 'true'::jsonb)
  ON CONFLICT (shop_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

  PERFORM private.log_provision_step(v_request_id, 'create_settings', 'completed', '{}'::jsonb);

  -- ─── Subscription ───
  PERFORM private.log_provision_step(v_request_id, 'create_subscription', 'started', '{}'::jsonb);

  INSERT INTO public.subscriptions (shop_id, plan_id, status, current_period_start)
  VALUES (v_shop_id, v_plan_id, 'active', now())
  RETURNING id INTO v_subscription_id;

  PERFORM private.log_provision_step(v_request_id, 'create_subscription', 'completed', jsonb_build_object('subscription_id', v_subscription_id));

  -- ─── Optional invitation ───
  IF p_use_invitation THEN
    PERFORM private.log_provision_step(v_request_id, 'create_invitation', 'started', '{}'::jsonb);

    INSERT INTO public.invitations (
      shop_id, email, role_id, invited_by, token_hash, status, expires_at
    ) VALUES (
      v_shop_id,
      lower(trim(p_owner_email)),
      v_role_id,
      p_provisioned_by,
      encode(sha256((p_idempotency_key || p_owner_email)::bytea), 'hex'),
      'pending',
      now() + interval '7 days'
    )
    RETURNING id INTO v_invitation_id;

    PERFORM private.log_provision_step(v_request_id, 'create_invitation', 'completed', jsonb_build_object('invitation_id', v_invitation_id));
  END IF;

  -- ─── Audit log ───
  BEGIN
    INSERT INTO public.audit_logs (shop_id, user_id, action, entity_type, entity_id, new_values, metadata)
    VALUES (
      v_shop_id,
      p_user_id,
      'provision',
      'shop',
      v_shop_id::text,
      jsonb_build_object('shop_name', p_shop_name, 'owner_email', p_owner_email),
      jsonb_build_object('milestone', 'E1', 'idempotency_key', p_idempotency_key)
    );
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  v_result := jsonb_build_object(
    'shopId', v_shop_id,
    'ownerUserId', p_user_id,
    'membershipId', v_membership_id,
    'branchId', v_branch_id,
    'warehouseId', v_warehouse_id,
    'subscriptionId', v_subscription_id,
    'invitationId', v_invitation_id,
    'invitationSent', p_use_invitation,
    'idempotencyKey', p_idempotency_key,
    'planCode', v_plan_mapped
  );

  UPDATE public.provisioning_requests
  SET status = 'completed', result = v_result, updated_at = now()
  WHERE id = v_request_id;

  PERFORM private.log_provision_step(v_request_id, 'commit', 'completed', v_result);

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    IF v_request_id IS NOT NULL THEN
      UPDATE public.provisioning_requests
      SET status = 'failed',
          error_code = SQLERRM,
          error_detail = SQLSTATE,
          updated_at = now()
      WHERE id = v_request_id;

      PERFORM private.log_provision_step(
        v_request_id, 'rollback', 'failed',
        jsonb_build_object('error', SQLERRM, 'sqlstate', SQLSTATE)
      );
    END IF;
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.provision_shop IS
  'Sprint E1 atomic shop provisioning. Caller must create auth user first. Idempotent via idempotency_key.';

-- Replace stub
DROP FUNCTION IF EXISTS public.provision_shop_stub(TEXT, TEXT);

REVOKE ALL ON FUNCTION public.provision_shop FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.provision_shop TO service_role;

REVOKE ALL ON FUNCTION private.map_plan_code(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION private.log_provision_step(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
