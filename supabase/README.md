# Supabase — RetailX POS V2

Infrastructure root for database migrations, seeds, Edge Functions, and tests.

## Structure

```
supabase/
├── config.toml          # Supabase CLI local config
├── config/
│   └── environments.json  # dev/staging/prod settings
├── migrations/          # Forward SQL migrations
│   └── rollback/        # Paired rollback scripts
├── seed/                # Idempotent platform seeds
├── functions/
│   ├── _shared/         # Auth, logging, validation, response helpers
│   └── health/          # Health check (infrastructure only)
└── tests/
    ├── unit/            # No database required
    └── integration/     # Requires DATABASE_URL
```

## Commands

See root [README](../README.md) and [Migration Guide](../docs/MIGRATION_GUIDE.md).

```bash
npm run db:backfill
npm run db:health
npm run db:cutover -- --fixture   # C3 staging cutover simulation
npm test
```

## Edge Functions

Shared modules in `functions/_shared/`:
- `auth.ts` — Bearer token middleware (scaffold)
- `logging.ts` — Structured JSON logs
- `validation.ts` — Request body validation
- `response.ts` — Standard API responses
- `cors.ts` — CORS headers

No business endpoints are implemented in Milestone A.
