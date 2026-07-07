# Backfill Guide — RetailX POS V2 Milestone C1

## Overview

Milestone C1 migrates existing V1 production data into V2 foundation tables **without changing the V1 application**. The backfill is:

- **Transactional** — all steps in one transaction; rolls back on failure
- **Idempotent** — safe to re-run; skips existing rows
- **Non-destructive** — never modifies or deletes V1 data
- **Audited** — writes to `audit_logs` and `backfill_runs`

## Prerequisites

```bash
npm run db:migrate    # Includes Milestone A, B, and C1 audit table
npm run db:seed       # Roles and plans required for mapping
```

Production already has V1 `shops` and `user_profiles`. CI/local testing:

```bash
npm run db:bootstrap
psql $DATABASE_URL -f supabase/tests/fixtures/v1_sample.sql  # optional test data
```

## Run Backfill

```bash
# Development
npm run db:backfill

# Staging
RETAILX_ENV=staging npm run db:backfill -- --env staging

# Production (requires confirmation)
RETAILX_CONFIRM=yes RETAILX_ENV=production npm run db:backfill -- --env production

# Dry run (counts only, no writes)
node scripts/infrastructure/backfill.mjs --dry-run
```

## What Gets Backfilled

| Step | Source | Target | Skip condition |
|------|--------|--------|----------------|
| Memberships | `user_profiles` | `memberships` | `(user_id, shop_id)` exists |
| Branches | `shops` | `branches` code=`MAIN` | MAIN branch exists |
| Warehouses | `shops` + MAIN branch | `warehouses` code=`DEFAULT` | DEFAULT warehouse exists |
| Shop settings | defaults + `shops.plan` | `shop_settings` | key exists (no overwrite) |
| Subscriptions | `shops.plan` | `subscriptions` | shop subscription exists |

## Role Mapping

| V1 `user_profiles.role` | V2 `system_roles.slug` |
|-------------------------|------------------------|
| `shop_owner` | `shop_owner` |
| `admin` | `platform_admin` |

First `shop_owner` per shop gets `is_primary = true`.

## Plan Mapping

| V1 `shops.plan` | V2 `plans.code` |
|-------------------|-----------------|
| `standard` | `starter` |
| `free` | `free` |
| `starter` | `starter` |
| `growth` | `growth` |
| `enterprise` | `enterprise` |
| unknown | `starter` (default) |

V1 `shops.plan` TEXT remains unchanged and authoritative for the V1 app.

## Verify

```bash
npm run db:backfill:verify
```

Runs 13 automated checks:

- Every shop has MAIN branch
- Every shop has DEFAULT warehouse
- Every user_profile has membership
- No orphan memberships
- No duplicate default branches
- No duplicate primary owners
- Valid FK on roles and plans
- DEFAULT warehouses linked to MAIN branch

## Rollback (development only)

```bash
npm run db:backfill:rollback
```

Removes only C1 backfill rows (identified by `MAIN`/`DEFAULT` codes and audit metadata). **Disabled in production.**

## Report Output

Each run prints:

- Run ID
- Rows processed / inserted / skipped per step
- Warnings (e.g. shops without owners)
- Verification results
- Duration

Reports are stored in `backfill_runs.report` JSONB.

## Default Shop Settings

| Key | Default value |
|-----|---------------|
| `pos.currency_default` | `INR` |
| `pos.tax_rate_default` | `0` |
| `pos.receipt_footer` | `""` |
| `onboarding.completed` | `false` |
| `legacy.plan_source` | `v1_shops.plan` |
| `legacy.plan_text` | copy of `shops.plan` |
| `onboarding.v2_backfill_completed` | `true` |

Existing keys are **never overwritten** (`ON CONFLICT DO NOTHING`).
