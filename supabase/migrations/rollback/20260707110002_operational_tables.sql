-- Rollback: 20260707110002_operational_tables

DROP TABLE IF EXISTS public.audit_logs;
DROP TABLE IF EXISTS public.event_outbox;
DROP TABLE IF EXISTS public.user_devices;
DROP TABLE IF EXISTS public.invitations;
