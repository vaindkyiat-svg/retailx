# Validation Guide — RetailX POS V2

## Validation Layers

| Layer | Tool | Scope |
|-------|------|-------|
| Schema | `npm run db:validate` | Migration file format |
| Backfill | `npm run db:backfill:verify` | C1 data (delegates to health) |
| Health | `npm run db:health` | Full V2 validation (C2) |
| Architecture | `npm run db:health -- --full` | RLS + indexes |
| CI | GitHub Actions | Automated on push |

## Check Categories

### Data Health (Part 1)
- Every shop: default branch, warehouse, settings, subscription
- Every owner: membership with valid role
- Every warehouse: valid branch FK
- Every branch: valid shop FK
- Every membership: valid user + shop

### Integrity Scanner (Part 2)
- Orphan records across all V2 tables
- Broken foreign keys
- Duplicate memberships and primary owners
- Multiple default branches/warehouses per shop
- Invalid subscriptions and inactive plans
- Dangling/expired invitations
- Stale devices
- Outbox stuck/failed states
- Audit log inconsistencies

### Architecture Rules (Part 7)
- RLS enabled on all V2 tables
- Required indexes present
- No shop without tenancy data

## Scheduled Validation

Configure in `supabase/config/health-schedule.json`:

```json
{
  "schedules": {
    "daily": { "cron": "0 2 * * *", "enabled": false },
    "weekly": { "cron": "0 3 * * 0", "enabled": false },
    "ci": { "enabled": true }
  }
}
```

Enable daily/weekly via cron job or GitHub Actions scheduled workflow.

## Performance

- Quick mode (`--quick`): ~30 checks, skips operations
- Full mode (default): all checks including outbox/invitations
- Large datasets: checks use indexed columns; typical runtime < 5s for 10k shops
