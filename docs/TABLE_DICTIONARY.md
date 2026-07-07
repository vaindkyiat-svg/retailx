# Table Dictionary — RetailX POS V2

## V2 Tenancy Tables (Milestone B)

### memberships

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Membership identifier |
| user_id | UUID | NN, FK→auth.users (conditional) | Authenticated user |
| shop_id | UUID | NN, FK→shops CASCADE | Tenant shop |
| role_id | UUID | NN, FK→system_roles RESTRICT | Assigned role |
| status | membership_status | NN, default active | active/suspended/removed |
| is_primary | BOOLEAN | NN, default false | Default shop for user |
| invited_by | UUID | | Inviter user id |
| joined_at | TIMESTAMPTZ | NN | When membership became active |
| deleted_at | TIMESTAMPTZ | | Soft delete timestamp |
| created_at | TIMESTAMPTZ | NN | Row creation |
| updated_at | TIMESTAMPTZ | NN | Last update (trigger) |

**Unique:** (user_id, shop_id)

---

### branches

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Branch identifier |
| shop_id | UUID | NN, FK→shops CASCADE | Parent shop |
| name | TEXT | NN, CHECK non-empty | Display name |
| code | TEXT | | Short code (unique per shop) |
| address, city, state, phone | TEXT | | Location contact |
| status | branch_status | NN, default active | active/inactive/archived |
| is_default | BOOLEAN | NN | Default branch flag |
| deleted_at | TIMESTAMPTZ | | Soft delete |
| created_at, updated_at | TIMESTAMPTZ | NN | Timestamps |

---

### warehouses

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Warehouse identifier |
| shop_id | UUID | NN, FK→shops CASCADE | Parent shop |
| branch_id | UUID | FK→branches SET NULL | Optional branch link |
| name | TEXT | NN | Display name |
| code | TEXT | | Short code (unique per shop) |
| status | warehouse_status | NN | active/inactive/archived |
| is_default | BOOLEAN | NN | Default warehouse |
| deleted_at | TIMESTAMPTZ | | Soft delete |
| created_at, updated_at | TIMESTAMPTZ | NN | Timestamps |

---

### shop_settings

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Setting row id |
| shop_id | UUID | NN, FK→shops CASCADE | Tenant |
| key | TEXT | NN, CHECK non-empty | Setting key |
| value | JSONB | NN | Setting value |
| created_at, updated_at | TIMESTAMPTZ | NN | Timestamps |

**Unique:** (shop_id, key)

---

### subscriptions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Subscription id |
| shop_id | UUID | NN, FK→shops CASCADE, UNIQUE | One per shop |
| plan_id | UUID | NN, FK→plans RESTRICT | Billing plan |
| status | subscription_status | NN | Billing state |
| trial_ends_at | TIMESTAMPTZ | | Trial expiry |
| current_period_start | TIMESTAMPTZ | NN | Billing period start |
| current_period_end | TIMESTAMPTZ | | Billing period end |
| cancelled_at | TIMESTAMPTZ | | Cancellation time |
| created_at, updated_at | TIMESTAMPTZ | NN | Timestamps |

---

### invitations

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Invitation id |
| shop_id | UUID | NN, FK→shops CASCADE | Target shop |
| email | TEXT | NN, email format CHECK | Invitee email |
| role_id | UUID | NN, FK→system_roles RESTRICT | Offered role |
| invited_by | UUID | | Inviter |
| token_hash | TEXT | NN | Hashed invite token |
| status | invitation_status | NN | pending/accepted/expired/revoked |
| expires_at | TIMESTAMPTZ | NN | Expiry |
| accepted_at | TIMESTAMPTZ | | Acceptance time |
| created_at, updated_at | TIMESTAMPTZ | NN | Timestamps |

---

### user_devices

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Device registration id |
| user_id | UUID | NN, FK→auth.users (conditional) | Owner |
| shop_id | UUID | FK→shops CASCADE | Associated shop |
| device_fingerprint | TEXT | NN | Client fingerprint |
| platform | device_platform | NN | web/ios/android/desktop |
| device_name | TEXT | | Friendly name |
| last_seen_at | TIMESTAMPTZ | NN | Last activity |
| is_trusted | BOOLEAN | NN | Trusted device flag |
| created_at, updated_at | TIMESTAMPTZ | NN | Timestamps |

**Unique:** (user_id, device_fingerprint)

---

### event_outbox

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Event id |
| shop_id | UUID | FK→shops CASCADE | Tenant scope |
| event_type | TEXT | NN | Event name |
| aggregate_type | TEXT | NN | Entity type |
| aggregate_id | TEXT | NN | Entity id |
| payload | JSONB | NN | Event data |
| status | outbox_status | NN | pending/processing/published/failed |
| attempts | INTEGER | NN, CHECK ≥0 | Retry count |
| available_at | TIMESTAMPTZ | NN | Next dispatch time |
| published_at | TIMESTAMPTZ | | Published time |
| error_message | TEXT | | Last error |
| created_at, updated_at | TIMESTAMPTZ | NN | Timestamps |

---

### audit_logs

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK | Log entry id |
| shop_id | UUID | FK→shops SET NULL | Tenant (nullable for platform) |
| user_id | UUID | | Actor |
| action | audit_action | NN | Action type enum |
| entity_type | TEXT | NN | Affected entity type |
| entity_id | TEXT | NN | Affected entity id |
| old_values | JSONB | | Before state |
| new_values | JSONB | | After state |
| ip_address | INET | | Client IP |
| user_agent | TEXT | | Client UA |
| metadata | JSONB | NN | Extra context |
| created_at | TIMESTAMPTZ | NN | Append-only timestamp |

## Platform Tables (Milestone A)

See Milestone A seeds. Key tables: `plans`, `system_roles`, `permissions`, `role_permissions`, `platform_settings`, `feature_flags`.

## Compatibility Views

| View | Maps to |
|------|---------|
| system_settings | platform_settings |
| v_user_shop_context | user_profiles + memberships + shops |
| v_shop_tenancy_summary | shops + subscriptions + counts |
