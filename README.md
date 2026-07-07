# RetailX POS V2

Point-of-sale application migrating from V1 monolith to a multi-tenant platform architecture.

## Quick Start

```bash
npm install
npm run dev
```

## V2 Infrastructure (Milestone A)

Foundation infrastructure is in `supabase/` and `scripts/infrastructure/`. No business logic, auth, or UI changes were made in this milestone.

### Prerequisites

- Node.js 22+ (24.x recommended)
- Postgres connection string (`DATABASE_URL`)
- Optional: [Supabase CLI](https://supabase.com/docs/guides/cli) for local dev (`npx supabase`)

### Database Setup

```bash
# Set your Postgres connection string (direct, not REST URL)
export DATABASE_URL="postgresql://postgres:password@localhost:54322/postgres"

# Validate migration files
npm run db:validate

# Apply migrations
npm run db:migrate

# Seed platform data (roles, permissions, plans, flags)
npm run db:seed

# Check migration status
npm run db:status
```

### Feature Flags

Toggle flags via CLI or environment overrides:

```bash
# CLI toggle (requires seeds)
npm run db:flag -- USE_V2_PROVISIONING true

# Environment override (takes precedence)
RETAILX_FLAG_USE_V2_PROVISIONING=true npm run dev
```

Available flags: `USE_V2_PROVISIONING`, `USE_MEMBERSHIP_AUTH`, `USE_MEMBERSHIP_RLS`, `WRITE_LEGACY_CREDENTIALS`, `USE_V2_CHECKOUT`, `ENABLE_EDGE_FUNCTIONS`

### Tests

```bash
npm test
```

Unit tests run without a database. Integration tests run when `DATABASE_URL` is set.

### Environments

| Environment   | Env var                  | Notes                          |
|---------------|--------------------------|--------------------------------|
| development   | `DATABASE_URL`           | Default; local or dev project  |
| staging       | `STAGING_DATABASE_URL`   | Requires SSL                   |
| production    | `PRODUCTION_DATABASE_URL`| Requires `RETAILX_CONFIRM=yes` |

Set `RETAILX_ENV=staging` or use `--env staging` on CLI scripts.

## Documentation

- [Migration Guide](docs/MIGRATION_GUIDE.md)
- [Developer Guide](docs/DEVELOPER_GUIDE.md)
- [Database Documentation](docs/DATABASE.md)
- [ER Diagram](docs/ER_DIAGRAM.md)
- [Table Dictionary](docs/TABLE_DICTIONARY.md)
- [Backfill Guide](docs/BACKFILL_GUIDE.md)
- [Recovery Guide](docs/RECOVERY_GUIDE.md)
- [Health Guide](docs/HEALTH_GUIDE.md)
- [Repair Guide](docs/REPAIR_GUIDE.md)
- [Validation Guide](docs/VALIDATION_GUIDE.md)
- [Auth Guide](docs/AUTH_GUIDE.md)
- [Cutover Guide](docs/CUTOVER_GUIDE.md)
- [Operational Runbook](docs/OPERATIONAL_RUNBOOK.md)
- [Supabase folder](supabase/README.md)

## Project Structure

```
supabase/
  migrations/     SQL migrations (timestamped)
  seed/           Idempotent platform seeds
  functions/      Edge Functions (Deno)
  tests/          Infrastructure tests
  config/         Environment configuration

scripts/infrastructure/   Migration pipeline CLI
src/lib/infrastructure/   Feature flag client (read-only)
```

## Original Project

Figma design: https://www.figma.com/design/oVPUWKaxZyX12bGjcQbr35/Point-of-Sale-Website
