# Staging Cutover Simulation — Milestone C3

## Overview

Milestone C3 simulates a full staging cutover **without production or frontend changes**. It runs the complete V2 foundation pipeline and measures readiness for auth migration.

## Pipeline

```
Load Snapshot (optional)
    ↓
Migrations
    ↓
Seeds
    ↓
Backfill (C1)
    ↓
Health Engine (C2)
    ↓
Repair Engine (if score < 99.5%)
    ↓
Verification
    ↓
Simulations (12 read-only scenarios)
    ↓
Rollback Validation
    ↓
Reports
```

## Commands

```bash
# Full simulation with representative dataset (local)
npm run db:cutover -- --fixture

# Against existing staging database
RETAILX_ENV=staging npm run db:cutover -- --env staging

# With auto-repair dry-run when health < 99.5%
npm run db:cutover -- --fixture --repair

# Apply repairs during simulation
npm run db:cutover -- --fixture --repair --repair-apply
```

## Simulations (read-only)

| Simulation | What it tests |
|------------|---------------|
| auth_simulation | V1 `user_profiles` lookup (getAuthUser path) |
| provisioning_simulation | `provision_shop_stub` correctly blocked |
| membership_resolution | V2 membership count per user |
| tenant_resolution_v1 | `user_profiles.shop_id` |
| tenant_resolution_v2 | `memberships` + role slug |
| dual_read_context | `v_user_shop_context` view |
| shop_login_simulation | Email → profile + shop join |
| product_queries | V1 `fetchProducts` pattern |
| sales_queries | V1 `fetchOrders` pattern |
| report_queries | Daily revenue aggregate |
| v2_tenancy_summary | Admin summary view |
| feature_flags_read | Pre-cutover flag states |

## Reports Generated

Written to `reports/cutover/<run-id>-*`:

| File | Content |
|------|---------|
| `*-cutover.json` | Full bundle |
| `*-cutover.md` | Human-readable summary |
| `*-performance.json` | Timing, memory, query perf |
| `*-risk.json` | Risk assessment + mitigations |

## Health Score Target

**100%** required for `cutoverReady: true` and `authMigrationReady: true`.

## Staging Snapshot Fixture

Representative dataset in `supabase/tests/fixtures/`:

- `v1_sample.sql` — 3 shops, 3 user profiles
- `staging_v1_business.sql` — products, orders, batches tables
- `staging_snapshot.sql` — 8 products, 3 orders, 1 batch

## No Production Changes

- Simulation mode only
- No auth implementation
- No frontend changes
- No RLS policy changes
- Rollback scripts validated but **not executed**

## Related

- [Operational Runbook](./OPERATIONAL_RUNBOOK.md)
- [Health Guide](./HEALTH_GUIDE.md)
- [Backfill Guide](./BACKFILL_GUIDE.md)
