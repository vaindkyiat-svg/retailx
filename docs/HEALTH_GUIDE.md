# Health Guide — RetailX POS V2 Milestone C2

## Overview

The Validation & Health Engine continuously verifies V2 database readiness for authentication migration. It does not modify the V1 application or enable new auth.

## Quick Start

```bash
npm run db:health
```

## Health Score

| Domain | Weight | Checks |
|--------|--------|--------|
| Memberships | 25% | profiles, roles, duplicates, orphans |
| Branches | 20% | default branch, MAIN code, valid shop |
| Warehouses | 20% | default warehouse, branch link |
| Settings | 15% | required keys, orphans |
| Subscriptions | 15% | plan validity, coverage |
| Operations | 3% | invitations, outbox, devices, audit |
| Architecture | 2% | RLS, indexes |

**Status thresholds:**
- `healthy` ≥ 99.5%
- `degraded` ≥ 90%
- `unhealthy` < 90%

## Report Formats

```bash
npm run db:health -- --format json,markdown,html --output reports/health
```

Reports saved to `reports/health/<run-id>.*`

## Triggers

| Trigger | Command |
|---------|---------|
| Manual | `npm run db:health` |
| Quick (no ops checks) | `npm run db:health -- --quick` |
| CI | `--trigger ci` |
| Daily | See `supabase/config/health-schedule.json` |
| Weekly | `--trigger weekly --full` |

## Historical Comparison

Each run is stored in `health_runs`. The report compares against the previous run for the same environment.

## When to Run

- After `db:backfill`
- Before auth migration cutover
- After any manual DB changes
- Daily in staging/production (scheduled)

## Exit Codes

- `0` — healthy or degraded
- `1` — unhealthy (errors detected)
