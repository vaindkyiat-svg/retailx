# RetailX POS V2 — Database Documentation

**Milestone B** — V2 database foundation alongside V1 (non-breaking).

## Overview

V2 tables are **additive**. The V1 application continues using `user_profiles`, `shops`, and shop-scoped business tables unchanged. V2 introduces membership-based tenancy, branches, warehouses, billing, and infrastructure tables for future milestones.

## Schema Layers

| Layer | Tables | Used by V1 App |
|-------|--------|----------------|
| V1 Business | shops, user_profiles, products, batches, orders, refunds, wastage_entries, drawer_* | Yes |
| V2 Platform | plans, system_roles, permissions, role_permissions, platform_settings, feature_flags | No (infrastructure) |
| V2 Tenancy | memberships, branches, warehouses, shop_settings, subscriptions | No (future) |
| V2 Operations | invitations, user_devices, event_outbox, audit_logs | No (future) |

## ER Diagram

See [ER_DIAGRAM.md](./ER_DIAGRAM.md).

## Table Dictionary

See [TABLE_DICTIONARY.md](./TABLE_DICTIONARY.md).

## Dependency Graph

See [DEPENDENCY_GRAPH.md](./DEPENDENCY_GRAPH.md).

## Private Helpers

| Function | Purpose |
|----------|---------|
| `private.current_user_id()` | Returns `auth.uid()` |
| `private.current_shop_id()` | V2 membership → V1 `user_profiles` fallback |
| `private.current_membership()` | Active membership row for current user |
| `private.is_platform_admin()` | Platform admin or V1 `admin` role |
| `private.is_shop_member(shop_id)` | Membership, V1 profile, or platform admin |

## Compatibility Views

| View | Purpose |
|------|---------|
| `system_settings` | Alias for `platform_settings` |
| `v_user_shop_context` | Joins V1 profiles with V2 memberships |
| `v_shop_tenancy_summary` | Shop + subscription + branch/warehouse counts |

## RLS Strategy

- V1 table policies: **unchanged**
- V2 tables: RLS enabled with skeleton policies (`v2_*` prefix)
- Writes to V2 tables denied for `authenticated` (service_role only until Milestone C)
- Reads allowed for platform admin and shop members via helper functions

## Running Migrations

```bash
npm run db:migrate
npm run db:seed
npm run db:backfill      # Milestone C1: V1→V2 data migration
npm run db:backfill:verify
npm run db:health          # Milestone C2: validation & health score
npm run db:repair -- all --dry-run
npm run db:cutover -- --fixture   # Milestone C3: staging cutover simulation
npm test
```

For CI/local testing without V1 schema, bootstrap first:

```bash
psql $DATABASE_URL -f supabase/tests/bootstrap/v1_minimal.sql
```

## Migration Numbers (Milestone B)

| Version | Name |
|---------|------|
| 20260707110000 | milestone_b_enums |
| 20260707110001 | tenancy_tables |
| 20260707110002 | operational_tables |
| 20260707110003 | infrastructure_triggers |
| 20260707110004 | private_helpers |
| 20260707110005 | milestone_b_indexes |
| 20260707110006 | compatibility_views |
| 20260707110007 | rls_skeleton |
| 20260707120000 | backfill_audit (C1) |
| 20260707130000 | health_engine (C2) |
| 20260707140000 | cutover_simulation (C3) |
