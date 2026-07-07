-- Migration: 20260707110000_milestone_b_enums
-- RetailX V2 Milestone B — Additional enum types for tenancy and operations

DO $$ BEGIN
  CREATE TYPE public.branch_status AS ENUM ('active', 'inactive', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.warehouse_status AS ENUM ('active', 'inactive', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.outbox_status AS ENUM ('pending', 'processing', 'published', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.audit_action AS ENUM (
    'create', 'update', 'delete', 'login', 'logout',
    'provision', 'invite', 'accept_invite', 'suspend', 'restore'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.device_platform AS ENUM ('web', 'ios', 'android', 'desktop', 'unknown');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
