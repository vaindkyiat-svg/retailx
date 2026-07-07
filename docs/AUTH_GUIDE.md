# Authentication Guide — RetailX POS V2

## Overview

Milestones **D1.1** and **D1.2** establish the Authentication Layer at `src/lib/auth/`. Auth logic has been **removed from `database.ts`**. The application imports `signIn`, `signOut`, and `getAuthUser` from `@/lib/auth` only.

**Production behavior is unchanged:** `USE_MEMBERSHIP_AUTH` defaults **OFF** — V1 `user_profiles` resolution remains active.

## Target Architecture

```
App.tsx
  ↓
AuthProvider
  ↓
AuthService          ← feature flag routing (V1 vs V2)
  ↓
AuthRepository       ← SupabaseAuthRepository (default)
  ↓
Supabase
  ↓
Identity Resolution (V1 profile OR V2 membership)
```

## Layer Responsibilities

### Repository Layer (`repositories/`)

| File | Role |
|------|------|
| `interfaces.ts` | `IAuthRepository` contract |
| `SupabaseAuthRepository.ts` | Supabase Auth + data fetch |
| `MockAuthRepository.ts` | Testing / offline |
| `map-errors.ts` | Supabase → `AuthError` mapping |
| `repository-logger.ts` | Technical event logging |

**Repository methods:** `signIn`, `signOut`, `getSession`, `refreshSession`, `getCurrentUser`, `fetchV1Profile`, `fetchMemberships`, `resolveIdentity`

No UI. No business logic. No feature flag decisions.

### Service Layer (`services/`)

| File | Role |
|------|------|
| `AuthService.ts` | Coordinates repository, resolvers, flags, errors |
| `index.ts` | Singleton `authService` factory |

**Only AuthService** reads `USE_MEMBERSHIP_AUTH` and passes `useMembershipAuth` to the repository.

Application code must **never** check auth flags directly.

### Identity Resolution (`identity/`)

| File | Role |
|------|------|
| `resolve-identity.ts` | `buildIdentityContext()` — pure dual-read |
| `types.ts` | `IdentityContext`, `IdentityResolutionMode` |

## Identity Resolution Flow

### When `USE_MEMBERSHIP_AUTH = OFF` (production default)

```
Supabase User → user_profiles → AuthUser (V1)
```

### When `USE_MEMBERSHIP_AUTH = ON` (not enabled in production)

```
Supabase User → memberships + system_roles → resolveMembership
              → resolveTenant → AuthUser (V2)
              → fallback to user_profiles if no membership
```

## Feature Flag Routing

| Flag | Decided by | Default |
|------|------------|---------|
| `USE_MEMBERSHIP_AUTH` | AuthService only | `false` |
| `USE_MEMBERSHIP_RLS` | Not used in D1.2 | `false` |
| `USE_V2_PROVISIONING` | Not used in D1.2 | `false` |

```typescript
// ✅ Correct — application code
import { signIn, getAuthUser } from '@/lib/auth';

// ❌ Forbidden — application code
import { isFeatureEnabled, FEATURE_FLAGS } from '@/lib/infrastructure/...';
import { SupabaseAuthRepository } from '@/lib/auth/repositories/...';
```

## Application API

```typescript
import {
  signIn,
  signOut,
  getAuthUser,
  getCurrentUser,
  getSession,
  refreshSession,
  authService,
  useAuth,
} from '@/lib/auth';
```

| Function | Returns | V1 behavior (flag off) |
|----------|---------|------------------------|
| `signIn(email, password)` | `AuthUser \| null` | Same as before |
| `signOut()` | `boolean` | Same as before |
| `getAuthUser()` | `AuthUser \| null` | V1 profile resolution |
| `getCurrentUser()` | `AuthUser \| null` | Alias |

## Error Handling

```
Repository throws AuthError
       ↓
AuthService catches → logs → returns null (signIn/getUser) or false (signOut)
       ↓
Application never sees raw Supabase errors
```

## Logging

| Layer | Logger | Content |
|-------|--------|---------|
| Repository | `logRepositoryEvent` | Fetch events, technical failures |
| Service | `logAuthEvent` | Sign in/out, identity resolved |

**Never logged:** password, JWT, refresh token, secrets.

## Migration Path

| Phase | Status |
|-------|--------|
| D1.1 Auth Core | ✅ Complete |
| D1.2 Identity Resolution | ✅ Complete |
| D1.3 Shadow Identity Validation | ✅ Complete (shadow mode only) |
| D1.4 Internal Shop Pilot | ✅ Complete (single shop, not global) |
| D1.5 Password reset | Pending |
| D2 Invitations + provisioning | Pending |
| D3 RLS activation | Pending |

## Shadow Mode (D1.3)

**Status:** Active in shadow only — **V1 remains authoritative**. No login behavior changes.

### Flow

```
User Login
  ↓
Legacy Authentication (ACTIVE — V1)
  ↓
AuthService.getCurrentUser() → returns V1 user immediately
  ↓
scheduleShadowValidation() — fire-and-forget via queueMicrotask
  ↓
ShadowIdentityValidator.validate()
  ↓
Parallel: resolveIdentity(V1) + resolveIdentity(V2)
  ↓
Tenant / membership / branch / permissions comparison
  ↓
Record metrics + identity_validation_log (in-memory)
  ↓
Discard V2 result — session unchanged
```

### Comparison Fields

| Field | Mismatch category |
|-------|-------------------|
| User ID | `ORPHAN_USER` |
| Email | `ORPHAN_USER` |
| Shop ID | `WRONG_SHOP` |
| Role | `WRONG_ROLE` |
| Tenant | `INVALID_TENANT` |
| Membership | `MISSING_MEMBERSHIP` |
| Branch | `WRONG_BRANCH` |
| Permissions | `WRONG_PERMISSION` |
| Unclassified | `UNKNOWN` |

### Mismatch Categories

- `MISSING_MEMBERSHIP` — V2 path has no membership for an active V1 shop user
- `WRONG_ROLE` — Role slug differs between V1 profile and V2 membership
- `WRONG_SHOP` — Shop ID resolved differently
- `WRONG_BRANCH` — Main branch code differs
- `WRONG_PERMISSION` — Permission set differs
- `ORPHAN_USER` — One path failed to resolve identity
- `INVALID_TENANT` — Tenant shop ID mismatch
- `UNKNOWN` — Unclassified divergence

### Performance Budget

| Constraint | Value |
|------------|-------|
| Login path impact | ≤ **20 ms** average (shadow runs async) |
| Failure handling | Swallowed — never fails login |
| Trigger | `signIn` only (not every `getAuthUser`) |

Shadow validation uses `queueMicrotask` so the login response returns before comparison runs.

### Metrics & Reports

```typescript
import { getShadowDashboardReport, shadowMetrics, exampleMismatchReport } from '@/lib/auth';

const { json, markdown, html } = getShadowDashboardReport();
console.log(shadowMetrics.getSnapshot());
```

Reports include: success %, mismatch %, top mismatch types, shops with mismatches, historical trend.

Server-side archive table: `identity_validation_log` (migration `20260707150000_identity_validation.sql`, RLS deny-all). Browser uses in-memory log only in D1.3.

### Migration Strategy (Shadow → Active V2)

1. **D1.3 (now):** Run shadow validation; fix data mismatches until match rate ≥ target
2. **D1.4+:** Password reset, invitations (still flag off)
3. **Cutover:** Enable `USE_MEMBERSHIP_AUTH` only after sustained match rate and ops approval
4. **D3:** Enable `USE_MEMBERSHIP_RLS` after membership auth is stable

### Rollback (D1.3)

1. Remove `scheduleShadowValidation` call from `AuthService.signIn`
2. Delete or disable `src/lib/auth/shadow/` imports
3. No database rollback required for shadow (in-memory only); optional: run rollback migration for `identity_validation_log`

**Login behavior unchanged** — rollback is code-only.

## Internal Shop Pilot (D1.4)

**Status:** Pilot infrastructure ready — **global `USE_MEMBERSHIP_AUTH` remains OFF**. Only shops listed in `pilot_shops` with `enabled=true` use membership auth.

### Auth path decision order

```
1. Emergency override  →  RETAILX_EMERGENCY_FORCE_V1=true  →  all shops V1
2. Pilot shop          →  pilot_shops.enabled for shop_id  →  V2 for that shop only
3. Global flag         →  USE_MEMBERSHIP_AUTH               →  V2 (not enabled in prod)
4. Legacy              →  V1 user_profiles
```

Only `AuthService` resolves the auth path. Application code never checks pilot status directly.

### Enable pilot (ops CLI)

```bash
npm run db:pilot -- enable <shop_uuid> --by ops@retailx.internal --notes "Internal pilot"
npm run db:pilot -- status
npm run db:pilot -- list
```

At most **one** shop may be enabled (DB unique index enforces this).

### Rollback (instant, no deploy)

```bash
# Per-shop rollback — reverts to V1 within cache TTL (~5s)
npm run db:pilot -- disable <shop_uuid>

# Emergency kill-switch — all shops V1 immediately
RETAILX_EMERGENCY_FORCE_V1=true
```

### Monitoring

```typescript
import { getPilotDashboardReport, pilotMetrics } from '@/lib/auth';

const { json, markdown, html } = await getPilotDashboardReport();
```

Tracks: login success/failure, shadow match/mismatch, avg login time, session errors, permission errors, active pilot shops, rollback status.

Shadow validation (D1.3) **remains active** during pilot for drift monitoring.

### Pilot table schema

| Column | Purpose |
|--------|---------|
| `shop_id` | Shop UUID (unique) |
| `enabled` | Pilot active |
| `enabled_by` | Operator identity |
| `enabled_at` | Activation timestamp |
| `notes` | Free-text context |

### Migrating call sites

Replace:
```typescript
import { signIn, signOut, getAuthUser } from '../lib/database';
```

With:
```typescript
import { signIn, signOut, getAuthUser } from '../lib/auth';
```

`database.ts` no longer exports auth functions.

## Testing

```bash
npm run test:auth
npm run test:auth:coverage
npm run validate:auth
npm test
```

## Architecture Rules

- ✅ No auth logic in `database.ts`
- ✅ App imports `@/lib/auth` public API only — not repositories
- ✅ No `service_role` in browser
- ✅ No SQL in service/provider layers
- ✅ Feature flag routing only in `AuthService`
- ✅ Shadow validation never awaits on login path
- ✅ Shadow mode cannot modify session, permissions, or database
- ✅ V2 identity result always discarded in shadow (`shadowDiscarded: true`)
- ✅ Pilot auth scoped to `pilot_shops` only — global flag off by default
- ✅ Single active pilot enforced at database level

## Rollback (D1.2)

1. Restore auth functions in `database.ts` from git history
2. Revert `App.tsx` imports to `database.ts`
3. Optionally remove service/repository layers

No database migrations required.

## Related

- [Operational Runbook](./OPERATIONAL_RUNBOOK.md)
- [Developer Guide](./DEVELOPER_GUIDE.md)
- [Cutover Guide](./CUTOVER_GUIDE.md)
