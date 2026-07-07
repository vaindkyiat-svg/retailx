# Shop Provisioning Engine (Sprint E1)

## Overview

One-click shop creation: admin submits shop + owner details; the system creates auth user, shop, membership, branch, warehouse, settings, and subscription in a single atomic flow.

## Enable (ops only — not enabled by default)

```bash
npm run db:flag -- USE_V2_PROVISIONING true
```

Requires `provision-shop` edge function deployed (browser) or service role (Node/scripts).

## Flow

1. **Validate** input (`provision-validator.ts`)
2. **Idempotency** — `provisioning_requests` keyed by `idempotency_key`
3. **Auth** — `supabase.auth.admin.createUser` (edge function or orchestrator)
4. **Database** — `provision_shop` RPC (transactional)
5. **Rollback** — on RPC failure, `deleteUser` compensates auth
6. **Business validation** — post-provision checks (`business-validation.ts`)

## Typed errors

| Code | Meaning |
|------|---------|
| `EMAIL_ALREADY_EXISTS` | Owner email already registered |
| `SHOP_ALREADY_EXISTS` | Shop name taken |
| `INVALID_PLAN` | No active plan for code |
| `PROVISION_FAILED` | Generic failure |
| `ROLLBACK_COMPLETED` | Auth user removed after DB failure |

## Tests

```bash
npm run test:provisioning          # Vitest unit tests
npm run test:infrastructure        # Includes provisioning integration (DB)
```

## Output

`shopId`, `ownerUserId`, `membershipId`, `branchId`, `warehouseId`, `subscriptionId`, `temporaryPassword` or `invitationSent`.
