# Repair Guide — RetailX POS V2 Milestone C2

## Overview

The repair engine fixes **missing or duplicate** V2 data using the same safe logic as C1 backfill. It never overwrites valid existing data.

## Rules

1. **Dry-run first** — always preview changes
2. **Never overwrites** — existing rows are skipped
3. **Transactional** — all repairs in one transaction (except dry-run)
4. **Reported** — every run writes `reports/repair/<run-id>.md`
5. **Production** — dry-run only via CLI guard

## Commands

```bash
# Preview repairs
npm run db:repair -- all --dry-run

# Repair specific domain
npm run db:repair -- memberships
npm run db:repair -- branches
npm run db:repair -- warehouses
npm run db:repair -- settings
npm run db:repair -- subscriptions
npm run db:repair -- defaults

# Repair everything
npm run db:repair -- all
```

## Repair Targets

| Target | Action |
|--------|--------|
| `memberships` | Create missing memberships from `user_profiles` |
| `branches` | Create MAIN branch per shop |
| `warehouses` | Create DEFAULT warehouse linked to MAIN |
| `settings` | Insert missing default keys only (`ON CONFLICT DO NOTHING`) |
| `subscriptions` | Create missing subscriptions from `shops.plan` |
| `defaults` | Demote duplicate `is_default` / `is_primary` flags (keeps oldest) |
| `all` | Run all targets in order |

## Suggested Workflow

```bash
npm run db:health                    # Identify issues
npm run db:repair -- all --dry-run   # Preview fixes
npm run db:repair -- all             # Apply fixes
npm run db:health                    # Verify 100%
```

## What Repair Does NOT Do

- Modify V1 tables (`shops`, `user_profiles`, products, orders)
- Delete data (except demoting duplicate default flags)
- Enable authentication or RLS
- Change application behavior
