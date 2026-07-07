# Infrastructure scripts — RetailX POS V2

Node.js CLI tools for database migrations, seeds, and feature flag management.

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `migrate.mjs` | `npm run db:migrate` | Apply pending migrations |
| `rollback.mjs` | `npm run db:rollback` | Roll back last migration(s) |
| `status.mjs` | `npm run db:status` | Show migration status |
| `validate.mjs` | `npm run db:validate` | Validate migration files |
| `seed.mjs` | `npm run db:seed` | Run idempotent seeds |
| `toggle-flag.mjs` | `npm run db:flag` | Toggle feature flag in DB |
| `test.mjs` | `npm test` | Run infrastructure tests |

## Shared Library

`lib/helpers.mjs` provides:
- Environment resolution (`RETAILX_ENV`)
- Database client creation
- Transaction wrapper
- Migration file listing and validation
- Checksum computation
- Structured logging
- `MigrationError` class

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Development Postgres connection |
| `STAGING_DATABASE_URL` | Staging connection |
| `PRODUCTION_DATABASE_URL` | Production connection |
| `RETAILX_ENV` | Active environment (default: development) |
| `RETAILX_CONFIRM` | Set to `yes` for production operations |
