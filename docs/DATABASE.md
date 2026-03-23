# Database Guide

RV Trax uses **PostgreSQL 16** with the **TimescaleDB** extension, managed by **Drizzle ORM**.

## Schema Overview

42 tables across 30 schema files in `packages/db/src/schema/`:

### Business Domain

| Table               | Purpose                        | Key Columns                                         |
| ------------------- | ------------------------------ | --------------------------------------------------- |
| `dealership_groups` | Multi-location organizations   | `name`, `settings`                                  |
| `dealerships`       | Individual dealership accounts | `name`, `group_id`, `subscription_tier`, `settings` |
| `users`             | User accounts with RBAC        | `email`, `role`, `dealership_id`                    |
| `refresh_tokens`    | JWT refresh token tracking     | `token_hash`, `user_id`, `expires_at`               |

### Inventory

| Table         | Purpose                    | Key Columns                                                        |
| ------------- | -------------------------- | ------------------------------------------------------------------ |
| `units`       | RV inventory items         | `vin`, `stock_number`, `make`, `model`, `year`, `status`, `lot_id` |
| `lots`        | Physical lot locations     | `name`, `address`, `boundary_geojson`                              |
| `lot_spots`   | Individual parking spots   | `zone`, `row`, `spot_number`, `lat`, `lng`                         |
| `unit_photos` | Photo attachments per unit | `unit_id`, `url`, `caption`, `sort_order`                          |
| `unit_notes`  | Notes attached to units    | `unit_id`, `content`, `user_id`                                    |

### GPS & IoT Tracking

| Table                 | Purpose                                   | Key Columns                                         |
| --------------------- | ----------------------------------------- | --------------------------------------------------- |
| `trackers`            | LoRaWAN GPS devices                       | `dev_eui`, `status`, `battery_pct`, `last_seen`     |
| `tracker_assignments` | Tracker-to-unit mapping                   | `tracker_id`, `unit_id`, `assigned_at`              |
| `gateways`            | LoRaWAN gateway devices                   | `gateway_id`, `name`, `lat`, `lng`, `lot_id`        |
| `gateway_telemetry`   | Gateway health metrics                    | `gateway_id`, `rssi`, `snr`, `timestamp`            |
| `location_history`    | GPS position log (TimescaleDB hypertable) | `tracker_id`, `lat`, `lng`, `accuracy`, `timestamp` |
| `movement_events`     | Zone/row/spot changes                     | `unit_id`, `from_spot`, `to_spot`, `timestamp`      |

### Geofencing

| Table              | Purpose                   | Key Columns                                         |
| ------------------ | ------------------------- | --------------------------------------------------- |
| `geo_fences`       | Zone boundary definitions | `name`, `boundary_geojson`, `lot_id`                |
| `geo_fence_events` | Enter/exit detections     | `geofence_id`, `unit_id`, `event_type`, `timestamp` |

### Alerts & Notifications

| Table           | Purpose                         | Key Columns                                                   |
| --------------- | ------------------------------- | ------------------------------------------------------------- |
| `alert_rules`   | Configurable alert triggers     | `name`, `type`, `conditions`, `channels`                      |
| `alerts`        | Alert instances                 | `rule_id`, `unit_id`, `severity`, `status`, `acknowledged_at` |
| `device_tokens` | Mobile push notification tokens | `user_id`, `token`, `platform`                                |

### Operations

| Table                 | Purpose                           | Key Columns                                            |
| --------------------- | --------------------------------- | ------------------------------------------------------ |
| `work_orders`         | Service/PDI tasks                 | `unit_id`, `type`, `priority`, `status`, `assigned_to` |
| `recalls`             | Manufacturer recall tracking      | `title`, `manufacturer`, `affected_models`             |
| `staging_plans`       | Lot organization plans            | `name`, `lot_id`, `status`                             |
| `staging_assignments` | Unit-to-spot assignments in plans | `plan_id`, `unit_id`, `spot_id`                        |

### Audit & Compliance

| Table                  | Purpose                   | Key Columns                                                |
| ---------------------- | ------------------------- | ---------------------------------------------------------- |
| `audit_log`            | All operation audit trail | `action`, `entity_type`, `entity_id`, `user_id`, `changes` |
| `compliance_snapshots` | Point-in-time lot state   | `lot_id`, `snapshot_data`, `timestamp`                     |

### Integration

| Table                | Purpose                          | Key Columns                                         |
| -------------------- | -------------------------------- | --------------------------------------------------- |
| `api_keys`           | Third-party API credentials      | `key_hash`, `name`, `scopes`, `rate_limit`          |
| `webhook_endpoints`  | Outgoing webhook configs         | `url`, `events`, `secret_hash`                      |
| `webhook_deliveries` | Delivery log with retry tracking | `endpoint_id`, `payload`, `status_code`, `attempts` |
| `dms_integrations`   | DMS connector configurations     | `provider`, `credentials`, `sync_config`            |
| `dms_sync_logs`      | Sync history                     | `integration_id`, `direction`, `records`, `status`  |

### Billing & Config

| Table               | Purpose                          | Key Columns                                     |
| ------------------- | -------------------------------- | ----------------------------------------------- |
| `billing_events`    | Stripe webhook events            | `stripe_event_id`, `type`, `data`               |
| `scheduled_reports` | Automated report definitions     | `name`, `schedule`, `format`, `recipients`      |
| `feature_flags`     | Per-dealership feature toggles   | `name`, `enabled`, `dealership_id`              |
| `widget_configs`    | Public inventory widget settings | `dealership_id`, `theme`, `filters`             |
| `unit_transfers`    | Inter-lot transfer records       | `unit_id`, `from_lot_id`, `to_lot_id`, `status` |

### v0.3.0 — Dealer-Ready Features

| Table                     | Purpose                           | Key Columns                                                    |
| ------------------------- | --------------------------------- | -------------------------------------------------------------- |
| `staff_activity_log`      | Who did what and when             | `user_id`, `action`, `entity_type`, `entity_id`, `metadata`    |
| `floor_plan_audits`       | Monthly inventory audits          | `dealership_id`, `status`, `total_units`, `verified_units`     |
| `floor_plan_audit_items`  | Per-unit audit checklist entries  | `audit_id`, `unit_id`, `status`, `expected_zone`, `found_zone` |
| `service_bays`            | Physical service bay definitions  | `name`, `bay_type`, `status`, `dealership_id`                  |
| `service_bay_assignments` | Unit-to-bay tracking with stages  | `bay_id`, `unit_id`, `stage`, `checked_in_at`, `total_minutes` |
| `dashboard_configs`       | Per-user dashboard widget layouts | `user_id`, `layout` (jsonb)                                    |

## TimescaleDB

The `location_history` table is a **TimescaleDB hypertable** — an auto-partitioned time-series table optimized for GPS telemetry:

```sql
-- Created automatically by migration
SELECT create_hypertable('location_history', 'timestamp');
```

Benefits:

- Automatic time-based partitioning (chunks by week)
- 10-100x faster time-range queries than standard PostgreSQL
- Built-in data retention policies
- Continuous aggregates for dashboard analytics

## Migration Workflow

### Creating a New Migration

```bash
# 1. Edit schema files in packages/db/src/schema/
# 2. Generate migration SQL
pnpm run db:generate

# 3. Review generated SQL in packages/db/src/migrations/
# 4. Apply to local database
pnpm run db:migrate
```

### Production Migration Process

1. **Test locally** — Apply migration against a local database
2. **Review SQL** — Check generated migration files for destructive operations
3. **Backup** — Always backup production database before migrating
4. **Apply** — Run `pnpm run db:migrate` against production `DATABASE_URL`
5. **Verify** — Check application health after migration

### Rollback Strategy

Drizzle ORM generates forward-only migrations. For rollbacks:

1. **Schema rollback** — Create a new migration that reverses the change
2. **Data rollback** — Restore from backup if data was lost
3. **Emergency** — Point-in-time recovery via PostgreSQL WAL archives

**Never** manually edit migration files after they have been applied to any environment.

## Seeding

```bash
# Seed demo data (creates dealership, users, units, trackers, lots)
pnpm run db:seed
```

The seeder creates:

- 1 dealership with 3 lots
- Admin user (admin@demo.rvtrax.com / password from `SEED_ADMIN_PASSWORD` env)
- 50+ RV units with realistic VINs, makes, models, and pricing
- 10 GPS trackers with assignments
- Sample alert rules, geofences, and work orders

## Browsing the Database

```bash
# Open Drizzle Studio (visual DB browser)
pnpm run db:studio
```

## Multi-Tenancy

Every table that stores dealer-specific data includes a `dealership_id` column with a foreign key to `dealerships`. The API middleware injects `dealershipId` into every query context, ensuring complete data isolation between tenants.

```typescript
// All queries automatically scoped:
const units = await db
  .select()
  .from(schema.units)
  .where(eq(schema.units.dealershipId, ctx.dealershipId));
```

## Indexing Strategy

Key indexes (defined in schema files):

- `units`: Composite on `(dealership_id, status)`, unique on `(dealership_id, vin)`
- `trackers`: Unique on `dev_eui`, index on `(dealership_id, status)`
- `location_history`: TimescaleDB hypertable index on `(tracker_id, timestamp)`
- `alerts`: Composite on `(dealership_id, status, severity)`
- `audit_log`: Index on `(dealership_id, created_at)`
