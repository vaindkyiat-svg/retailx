# Developer Guide — RetailX POS V2

## Milestone A Scope

Milestone A delivers **infrastructure only**:
- Migration pipeline (dev/staging/prod)
- Idempotent seeds (roles, permissions, plans, settings, feature flags)
- Feature flag framework (DB + env overrides)
- Edge Function scaffold (`_shared` helpers + health endpoint)
- Test infrastructure + CI

**Not in scope:** auth, provisioning, business logic, UI, login, checkout.

## Local Development

### Frontend

```bash
npm install
cp .env.example .env.local   # if available
npm run dev
```

Required env vars for the SPA:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Database

Use a direct Postgres connection string (from Supabase Dashboard → Settings → Database):

```bash
export DATABASE_URL="postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
export RETAILX_ENV=development

npm run db:migrate
npm run db:seed
```

### Edge Functions

```bash
npx supabase functions serve health --env-file .env.local
curl http://localhost:54321/functions/v1/health
```

## Feature Flags

### Reading flags (application code)

```typescript
import { isFeatureEnabled, FEATURE_FLAGS } from '@/lib/infrastructure/feature-flag-client';

if (await isFeatureEnabled(FEATURE_FLAGS.USE_V2_PROVISIONING)) {
  // V2 path (future milestone)
}
```

### Toggling flags

**CLI (database):**
```bash
npm run db:flag -- USE_MEMBERSHIP_AUTH true --env development
```

**Environment override (highest priority):**
```bash
RETAILX_FLAG_USE_V2_PROVISIONING=true npm run dev
```

**Database table:** `public.feature_flags`

## Folder Reference

| Path | Purpose |
|------|---------|
| `supabase/migrations/` | Forward SQL migrations |
| `supabase/migrations/rollback/` | Rollback SQL per migration |
| `supabase/seed/` | Idempotent platform seeds |
| `supabase/functions/_shared/` | Edge Function shared code |
| `supabase/functions/health/` | Health check endpoint |
| `supabase/config/` | Environment definitions |
| `supabase/tests/` | Unit + integration tests |
| `scripts/infrastructure/` | Migration/seed CLI |
| `src/lib/infrastructure/` | Client-side flag utilities |

## Adding a New Feature Flag

1. Add to `supabase/seed/06_feature_flags.sql`
2. Add to `src/lib/infrastructure/feature-flags.ts` (`FEATURE_FLAGS` + `DEFAULT_FLAGS`)
3. Re-run seeds: `npm run db:seed`
4. Toggle via `npm run db:flag -- NEW_FLAG true`

## Testing

```bash
# All infrastructure tests
npm test

# Validate migrations only
npm run db:validate
```

Integration tests require `DATABASE_URL`.

## Code Conventions

- Migrations: pure SQL, no business logic
- Seeds: always idempotent (`ON CONFLICT`)
- Edge Functions: Deno, import from `_shared/`
- No changes to `App.tsx`, `database.ts` business functions, or checkout flow in Milestone A

## Next Milestones (pending approval)

- **Milestone C1:** V1→V2 data backfill (`npm run db:backfill`) — **complete**
- **Milestone C:** V2 provisioning (`provision_shop` RPC)
- **Milestone D:** RLS cutover (`USE_MEMBERSHIP_RLS`)
