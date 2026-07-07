# Release Engineering Guide — RetailX POS V2

## Overview

Milestone **D1.4A** adds the Release Engineering layer at `src/lib/auth/release/`. This layer **decides IF rollout is allowed** — it does not enable pilot, change login, or modify UI.

```
Shadow Validation (D1.3)  →  metrics
Pilot Infrastructure (D1.4) →  per-shop config
Release Controller (D1.4A)  →  GO | HOLD | ROLLBACK | BLOCK
```

## Rollout Process

1. **Collect metrics** — shadow validation + pilot monitoring + health inputs
2. **Evaluate gates** — `RolloutController.evaluate()` or `evaluateReleaseRollout()`
3. **Review decision** — GO / HOLD / ROLLBACK / BLOCK with reasons
4. **Human approval** — ops enables pilot only after GO (via `npm run db:pilot -- enable`)
5. **Monitor** — continuous evaluation while pilot active
6. **Rollback** — automatic ROLLBACK on threshold breach (pilot only)

## Decision Types

| Decision | Meaning |
|----------|---------|
| **GO** | All gates passed — rollout may proceed (with approval) |
| **HOLD** | Gates not met — wait, collect more data, or fix issues |
| **ROLLBACK** | Active pilot exceeds rollback thresholds — disable pilot |
| **BLOCK** | Blocking gate failed or emergency override — rollout forbidden |

Every decision includes gate evaluations, reasons, and a metrics snapshot.

## Approval Flow

```
Engineering → evaluateReleaseRollout() → GO
     ↓
Ops review → getReleaseDashboardReport()
     ↓
Explicit approval → npm run db:pilot -- enable <shop_id> --by approver@company
     ↓
Monitor → evaluateReleaseRollout() on schedule
```

**The rollout controller never enables pilot automatically.**

## Configurable Gates

All thresholds live in `ReleaseGate.ts` (`DEFAULT_RELEASE_GATE_CONFIG`):

| Gate | Default | Operator | Rollback Trigger |
|------|---------|----------|------------------|
| Shadow Match % | ≥ 90 | min | no |
| Login Success % | ≥ 95 | min | no (blocking) |
| Mismatch % | ≤ 10 | max | yes |
| Session Errors | ≤ 5 | max | yes |
| Permission Errors | ≤ 3 | max | yes |
| Auth Errors | ≤ 10 | max | yes (blocking) |
| Login Time (ms) | ≤ 3000 | max | no |
| Health Score | ≥ 80 | min | no (blocking) |
| Database Health | true | eq | no (blocking) |
| Architecture Validation | true | eq | no (blocking) |

Override gates via `RolloutController.setGateConfig()` or pass `gateConfig` to `evaluate()`.

## Rollback

### Automatic (pilot only)

When an active pilot shop crosses a `rollbackTrigger` gate:

1. Decision → **ROLLBACK**
2. Incident recorded (`AuthIncident`)
3. Rollback handler invoked (default: logs CLI command)
4. Release history entry created

```bash
npm run db:pilot -- disable <shop_id>
```

### Emergency kill-switch

```bash
RETAILX_EMERGENCY_FORCE_V1=true
```

Forces **BLOCK** on all rollout evaluations. All shops remain on V1.

## Incident Response

Incidents are tracked in `authIncidentEngine`:

| Field | Description |
|-------|-------------|
| `id` | Unique incident ID |
| `severity` | low / medium / high / critical |
| `category` | MISMATCH_THRESHOLD, LOGIN_FAILURE, etc. |
| `shop` | Affected shop ID |
| `reason` | Human-readable cause |
| `metrics` | Snapshot at incident time |
| `resolved` | Resolution status |

Resolve via `authIncidentEngine.resolveIncident(id)`.

## Release History

In-memory store (`releaseHistoryStore`) + DB archive (`release_history` table).

Each entry records: version, shop, decision, metrics snapshot, approved by, rollback flag, duration, reasons.

## Monitoring Dashboard

```typescript
import {
  getReleaseDashboardReport,
  evaluateReleaseRollout,
  rolloutController,
} from '@/lib/auth';

const decision = await evaluateReleaseRollout({ shopId, approvedBy: 'ops@company' });
const { json, markdown, html } = await getReleaseDashboardReport();
```

Dashboard includes: current pilot, phase, health, shadow match, mismatch, success rate, performance, open incidents, rollback command.

## CLI

```bash
npm run release:evaluate
npm run release:evaluate -- --shop <uuid> --approved-by ops@company
npm run validate:auth
```

## Release Checklist

- [ ] Architecture validation passes (`npm run validate:auth`)
- [ ] Shadow match rate ≥ threshold for ≥ 7 days
- [ ] `evaluateReleaseRollout()` returns **GO**
- [ ] Health score ≥ 80
- [ ] Database health OK
- [ ] Ops approval recorded (`approvedBy`)
- [ ] Rollback command documented for shop
- [ ] On-call notified of pilot window
- [ ] `npm run db:pilot -- enable` executed manually
- [ ] Post-enable monitoring active

## Architecture Rules

- Release controller is **advisory only**
- No integration in `AuthService.signIn`
- No pilot enable from release module
- No global `USE_MEMBERSHIP_AUTH` enable
- Emergency override always respected
- All thresholds configurable (not hardcoded in controller)

## Related

- [Authentication Guide](./AUTH_GUIDE.md)
- [Operational Runbook](./OPERATIONAL_RUNBOOK.md)
- [Cutover Guide](./CUTOVER_GUIDE.md)
