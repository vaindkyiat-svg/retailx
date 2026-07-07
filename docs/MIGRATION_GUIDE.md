# Migration Guide — RetailX POS V2

## Overview

RetailX V2 uses a custom Node.js migration pipeline (`scripts/infrastructure/`) that works with or without the Supabase CLI. Migrations are timestamped SQL files in `supabase/migrations/`.

## Naming Convention

```
YYYYMMDDHHMMSS_descriptive_name.sql
```

Example: `20260707100001_platform_foundation.sql`

## Workflow

### 1. Create a migration

Add a new `.sql` file to `supabase/migrations/` with a timestamp after the latest migration.

Include a header comment:
```sql
-- Migration: 20260708120000_my_change
-- Purpose: Brief description
```

### 2. Create a rollback (required)

Add a matching file to `supabase/migrations/rollback/`:
```
supabase/migrations/rollback/20260708120000_my_change.sql
```

Rollback is **disabled in production** via CLI. Production rollbacks require manual DBA intervention.

### 3. Validate

```bash
npm run db:validate
```

### 4. Apply

```bash
# Development (default)
npm run db:migrate

# Staging
RETAILX_ENV=staging npm run db:migrate:staging

# Production (requires confirmation)
RETAILX_CONFIRM=yes RETAILX_ENV=production npm run db:migrate:production
```

### 5. Check status

```bash
npm run db:status
```

Shows applied/pending migrations and checksum drift warnings.

### 6. Rollback (development only)

```bash
npm run db:rollback
npm run db:rollback -- --steps 2
```

## Migration History

Applied migrations are recorded in `public.migration_history` with:
- version, name, checksum
- environment (development / staging / production)
- status (applied / rolled_back)
- execution time

## Checksum Drift

If a migration file is modified after being applied, `db:status` shows `⚠ DRIFT`. Never edit applied migrations — create a new migration instead.

## Supabase CLI (optional)

If Supabase CLI is installed:

```bash
npx supabase start          # Local stack
npx supabase db push        # Push migrations to linked project
npx supabase functions serve # Local Edge Functions
```

The custom pipeline remains the source of truth for CI and multi-environment deploys.

## Foundation Migrations (Milestone A)

| Version            | Name                    | Purpose                              |
|--------------------|-------------------------|--------------------------------------|
| 20260707100000     | extensions_and_enums    | Extensions, enums, migration bootstrap |
| 20260707100001     | platform_foundation     | Plans, roles, flags, settings        |
| 20260707100002     | private_helpers_stub    | Private schema stub                  |

## Database Foundation Migrations (Milestone B)

| Version            | Name                    | Purpose                              |
|--------------------|-------------------------|--------------------------------------|
| 20260707110000     | milestone_b_enums       | Branch, warehouse, outbox, audit enums |
| 20260707110001     | tenancy_tables          | memberships, branches, warehouses, shop_settings, subscriptions |
| 20260707110002     | operational_tables      | invitations, user_devices, event_outbox, audit_logs |
| 20260707110003     | infrastructure_triggers | updated_at triggers, soft-delete guard |
| 20260707110004     | private_helpers         | V2 helpers with V1 fallback          |
| 20260707110005     | milestone_b_indexes     | Performance indexes with comments    |
| 20260707110006     | compatibility_views     | system_settings, v_user_shop_context |
| 20260707110007     | rls_skeleton            | RLS on V2 tables only                |

**Prerequisite:** V1 `shops` table must exist (use `npm run db:bootstrap` for CI/local).

Milestone B is **additive only** — no V1 table or policy changes.

## Data Backfill (Milestone C1)

C1 is a **data migration**, not a schema migration. Run after Milestone B:

```bash
npm run db:backfill
npm run db:backfill:verify
```

| Artifact | Purpose |
|----------|---------|
| `20260707120000_backfill_audit.sql` | `backfill_runs` tracking table |
| `scripts/infrastructure/backfill.mjs` | Transactional backfill runner |
| `scripts/infrastructure/verify-backfill.mjs` | Post-backfill verification |
| `scripts/infrastructure/rollback-backfill.mjs` | Dev rollback (not production) |

See [Backfill Guide](./BACKFILL_GUIDE.md) and [Recovery Guide](./RECOVERY_GUIDE.md).

## Staging Cutover Simulation (Milestone C3)

C3 simulates a full staging cutover without production or frontend changes:

```bash
npm run db:cutover -- --fixture    # Local with representative snapshot
npm run db:cutover -- --env staging
```

Pipeline: migrations → seeds → backfill → health → repair → verification → 12 simulations → rollback validation → reports.

| Artifact | Purpose |
|----------|---------|
| `20260707140000_cutover_simulation.sql` | `cutover_runs` tracking table |
| `scripts/infrastructure/cutover.mjs` | Simulation CLI |
| `supabase/tests/fixtures/staging_snapshot.sql` | Representative dataset |

See [Cutover Guide](./CUTOVER_GUIDE.md).

## Seeds

After migrations, run seeds:

```bash
npm run db:seed
```

Seeds are idempotent (`ON CONFLICT`). Re-running is safe.

## CI

GitHub Actions workflow `.github/workflows/infrastructure.yml`:
- Validates migrations on every PR
- Runs unit tests
- Runs integration tests on `main` with Postgres 15 service container
