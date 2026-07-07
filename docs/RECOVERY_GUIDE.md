# Recovery Guide — RetailX POS V2

## Milestone C1 Backfill Recovery

### Scenario: Backfill failed mid-transaction

The C1 backfill runs in a **single transaction**. If any step or verification fails, PostgreSQL rolls back all changes automatically. No partial state is left.

**Action:** Fix the root cause (missing seeds, invalid data), then re-run:

```bash
npm run db:backfill
```

### Scenario: Backfill succeeded but verification fails on re-check

```bash
npm run db:backfill:verify
```

Review failing checks in the output. Common causes:

| Check | Cause | Fix |
|-------|-------|-----|
| `every_shop_has_main_branch` | Branch step skipped | Re-run backfill |
| `every_user_profile_has_membership` | Missing system_role seed | `npm run db:seed` then re-run |
| `shops_without_owner` warning | Shop has no user_profile | Create profile manually or accept warning |

### Scenario: Need to undo backfill (development)

```bash
npm run db:backfill:rollback
```

This removes:
- Memberships created by C1 (via audit log tracking)
- Branches with code `MAIN`
- Warehouses with code `DEFAULT`
- Default shop_settings keys
- Subscriptions created by C1
- C1 audit log entries

**V1 tables are never touched.**

### Scenario: Accidental double-run

Safe. Second run skips all existing rows. Verification should still pass.

### Scenario: Production backfill rollback needed

`db:backfill:rollback` is **blocked in production**. Contact DBA for manual recovery using audit_logs:

```sql
SELECT * FROM public.audit_logs
WHERE metadata->>'milestone' = 'C1'
ORDER BY created_at DESC;
```

### Scenario: Migration pipeline failure

```bash
npm run db:status
npm run db:rollback        # dev/staging only
npm run db:migrate
```

See [Migration Guide](./MIGRATION_GUIDE.md).

### Scenario: V1 app broken after backfill

C1 does not modify V1 tables, policies, or application code. If the V1 app breaks:

1. Confirm no Milestone C+ RLS changes were applied
2. Check `feature_flags` — V2 flags should remain `false`
3. Verify V1 tables unchanged: `shops`, `user_profiles`, `products`, etc.

### Emergency contacts checklist

1. Capture backfill report: `SELECT report FROM backfill_runs ORDER BY started_at DESC LIMIT 1`
2. Capture verification: `npm run db:backfill:verify`
3. Export audit trail: `SELECT * FROM audit_logs WHERE metadata->>'milestone' = 'C1'`
4. Do **not** drop V1 tables

## Related docs

- [Backfill Guide](./BACKFILL_GUIDE.md)
- [Migration Guide](./MIGRATION_GUIDE.md)
- [Database Documentation](./DATABASE.md)
