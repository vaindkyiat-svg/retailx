# Dependency Graph — RetailX POS V2 (Milestone B)

```mermaid
flowchart TD
  subgraph auth [Supabase Auth]
    AU[auth.users]
  end

  subgraph v1 [V1 Tables - Unchanged]
    SH[shops]
    UP[user_profiles]
    PR[products]
    OR[orders]
  end

  subgraph platform [Platform - Milestone A]
    PL[plans]
    SR[system_roles]
    PE[permissions]
    RP[role_permissions]
    PS[platform_settings]
    FF[feature_flags]
  end

  subgraph tenancy [Tenancy - Milestone B]
    MB[memberships]
    BR[branches]
    WH[warehouses]
    SS[shop_settings]
    SU[subscriptions]
  end

  subgraph ops [Operations - Milestone B]
    IN[invitations]
    UD[user_devices]
    EO[event_outbox]
    AL[audit_logs]
  end

  subgraph helpers [Private Helpers]
    H1[current_user_id]
    H2[current_shop_id]
    H3[is_shop_member]
    H4[is_platform_admin]
  end

  AU --> MB
  AU --> UD
  AU --> UP

  SH --> MB
  SH --> BR
  SH --> WH
  SH --> SS
  SH --> SU
  SH --> IN
  SH --> EO
  SH --> AL
  SH --> UP
  SH --> PR
  SH --> OR

  BR --> WH
  SR --> MB
  SR --> IN
  SR --> RP
  PE --> RP
  PL --> SU

  MB --> H2
  MB --> H3
  UP --> H2
  UP --> H3
  MB --> H4
  UP --> H4

  H1 --> H2
  H2 --> H3
```

## Migration Dependency Order

```
20260707100000 extensions_and_enums
    └── 20260707100001 platform_foundation (plans, roles, flags)
        └── 20260707100002 private_helpers_stub
            └── 20260707110000 milestone_b_enums
                └── 20260707110001 tenancy_tables (requires shops)
                    └── 20260707110002 operational_tables
                        └── 20260707110003 infrastructure_triggers
                            └── 20260707110004 private_helpers
                                └── 20260707110005 milestone_b_indexes
                                    └── 20260707110006 compatibility_views
                                        └── 20260707110007 rls_skeleton
```

## External Dependencies

| Dependency | Required for | Notes |
|------------|--------------|-------|
| `public.shops` (V1) | tenancy_tables FK | Exists in production; bootstrap for CI |
| `auth.users` (Supabase) | memberships, user_devices FK | Conditional FK — skipped on plain Postgres |
| `gen_random_uuid()` | All UUID PKs | Requires pgcrypto extension (Milestone A) |

## Rollback Order (reverse)

```
rls_skeleton → compatibility_views → indexes → private_helpers
→ triggers → operational_tables → tenancy_tables → milestone_b_enums
```

Rollback does **not** drop V1 tables or Milestone A platform tables.
