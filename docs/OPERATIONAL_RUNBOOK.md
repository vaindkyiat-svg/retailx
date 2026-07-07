# Operational Runbook — RetailX POS V2 Database

## Daily Operations

### Morning health check
```bash
npm run db:health -- --trigger daily --format markdown
```

Review score. If < 99.5%, proceed to repair workflow.

### After deployments
```bash
npm run db:migrate
npm run db:seed
npm run db:health
```

## Incident Response

### Health score dropped

1. Run full health report:
   ```bash
   npm run db:health -- --full --format json,markdown
   ```
2. Review failed checks and repair suggestions
3. Dry-run repair:
   ```bash
   npm run db:repair -- all --dry-run
   ```
4. Apply repair:
   ```bash
   npm run db:repair -- all
   ```
5. Re-verify:
   ```bash
   npm run db:health
   ```

### Backfill needed on new shops

V1 shops created after C1 backfill won't have V2 data until:
```bash
npm run db:backfill    # or
npm run db:repair -- all
```

### V1 app issues

C2 does not touch V1. If POS breaks:
1. Confirm no auth/RLS milestone was applied
2. Check V1 tables unchanged
3. See [Recovery Guide](./RECOVERY_GUIDE.md)

## Pre-Auth-Migration Checklist

- [ ] `npm run db:cutover` → cutover ready (C3 simulation)
- [ ] `npm run db:health` → 100% healthy
- [ ] Zero errors in health report
- [ ] All shops have memberships
- [ ] All shops have MAIN branch + DEFAULT warehouse
- [ ] All subscriptions mapped
- [ ] Feature flags: `USE_MEMBERSHIP_AUTH=false` (until cutover)
- [ ] Backfill report archived
- [ ] Health history shows stable scores

## Commands Reference

| Command | Purpose |
|---------|---------|
| `db:migrate` | Apply schema migrations |
| `db:seed` | Platform roles/plans |
| `db:backfill` | C1 V1→V2 data migration |
| `db:health` | C2 validation & health score |
| `db:repair` | C2 safe repairs |
| `db:cutover` | C3 staging cutover simulation |
| `db:backfill:verify` | Quick validation (alias) |

## Escalation

| Severity | Score | Action |
|----------|-------|--------|
| P3 | 90–99.5% | Schedule repair within 24h |
| P2 | 70–90% | Repair within 4h |
| P1 | < 70% | Immediate repair; block auth migration |

## Related Docs

- [Health Guide](./HEALTH_GUIDE.md)
- [Repair Guide](./REPAIR_GUIDE.md)
- [Validation Guide](./VALIDATION_GUIDE.md)
- [Backfill Guide](./BACKFILL_GUIDE.md)
- [Recovery Guide](./RECOVERY_GUIDE.md)
