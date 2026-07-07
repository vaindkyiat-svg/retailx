-- Migration: 20260707100000_extensions_and_enums
-- RetailX V2 Milestone A — Foundation
-- Purpose: Enable extensions and create enum types for platform infrastructure

-- Bootstrap migration history (required before pipeline can record versions)
CREATE TABLE IF NOT EXISTS public.migration_history (
  id BIGSERIAL PRIMARY KEY,
  version TEXT NOT NULL,
  name TEXT NOT NULL,
  checksum TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'applied',
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rolled_back_at TIMESTAMPTZ,
  applied_by TEXT,
  environment TEXT NOT NULL DEFAULT 'development',
  execution_ms INTEGER
);

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA extensions;

-- Platform & tenancy
DO $$ BEGIN
  CREATE TYPE public.organization_status AS ENUM ('active', 'suspended', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.shop_status AS ENUM ('provisioning', 'active', 'suspended', 'cancelled', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'cancelled', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.membership_status AS ENUM ('active', 'suspended', 'removed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.role_scope AS ENUM ('platform', 'shop');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Infrastructure
DO $$ BEGIN
  CREATE TYPE public.migration_status AS ENUM ('applied', 'rolled_back');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
