-- RV Trax Initial Migration
-- Creates all 35 tables with proper dependency ordering
-- Requires PostgreSQL 13+ and TimescaleDB extension

-- ============================================================================
-- Extensions (safety net - init-db.sh should already create these)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;

-- ============================================================================
-- 1. dealership_groups
-- ============================================================================
CREATE TABLE IF NOT EXISTS "dealership_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. dealerships (references dealership_groups)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "dealerships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "group_id" uuid REFERENCES "dealership_groups"("id"),
  "name" text NOT NULL,
  "address" text NOT NULL,
  "city" text NOT NULL,
  "state" text NOT NULL,
  "zip" text NOT NULL,
  "timezone" text NOT NULL DEFAULT 'America/New_York',
  "logo_url" text,
  "stripe_customer_id" text,
  "subscription_tier" text NOT NULL DEFAULT 'starter',
  "subscription_status" text NOT NULL DEFAULT 'active',
  "settings" jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. users (references dealerships, self-references invited_by)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dealership_id" uuid NOT NULL REFERENCES "dealerships"("id"),
  "email" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "name" text NOT NULL,
  "role" text NOT NULL,
  "avatar_url" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "invited_by" uuid REFERENCES "users"("id"),
  "last_login_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. refresh_tokens (references users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. lots (references dealerships)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "lots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dealership_id" uuid NOT NULL REFERENCES "dealerships"("id"),
  "name" text NOT NULL,
  "address" text,
  "boundary" text,
  "map_image_url" text,
  "total_spots" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 6. lot_spots (references lots)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "lot_spots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lot_id" uuid NOT NULL REFERENCES "lots"("id") ON DELETE CASCADE,
  "row_label" text NOT NULL,
  "spot_number" integer NOT NULL,
  "spot_type" text NOT NULL DEFAULT 'standard',
  "center_lat" numeric,
  "center_lng" numeric,
  "width_ft" numeric,
  "depth_ft" numeric,
  "is_active" boolean NOT NULL DEFAULT true,
  CONSTRAINT "uq_lot_spots_row_spot" UNIQUE ("lot_id", "row_label", "spot_number")
);

-- ============================================================================
-- 7. units (references dealerships, lots)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "units" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dealership_id" uuid NOT NULL REFERENCES "dealerships"("id"),
  "lot_id" uuid REFERENCES "lots"("id"),
  "stock_number" text NOT NULL,
  "vin" text,
  "year" integer,
  "make" text,
  "model" text,
  "floorplan" text,
  "unit_type" text,
  "length_ft" numeric,
  "msrp" numeric,
  "status" text NOT NULL DEFAULT 'new_arrival',
  "current_zone" text,
  "current_row" text,
  "current_spot" integer,
  "arrived_at" timestamptz DEFAULT now(),
  "sold_at" timestamptz,
  "archived_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "uq_units_dealership_stock" UNIQUE ("dealership_id", "stock_number")
);

CREATE INDEX IF NOT EXISTS "idx_units_dealership_status" ON "units" ("dealership_id", "status");
CREATE INDEX IF NOT EXISTS "idx_units_vin" ON "units" ("vin");

-- ============================================================================
-- 8. trackers (references dealerships)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "trackers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dealership_id" uuid NOT NULL REFERENCES "dealerships"("id"),
  "device_eui" text NOT NULL UNIQUE,
  "label" text,
  "firmware_version" text,
  "status" text NOT NULL DEFAULT 'unassigned',
  "battery_pct" integer,
  "battery_mv" integer,
  "last_seen_at" timestamptz,
  "last_latitude" numeric,
  "last_longitude" numeric,
  "signal_rssi" integer,
  "retired_at" timestamptz,
  "retired_reason" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 9. tracker_assignments (references trackers, units, users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "tracker_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tracker_id" uuid NOT NULL REFERENCES "trackers"("id"),
  "unit_id" uuid NOT NULL REFERENCES "units"("id"),
  "assigned_by" uuid REFERENCES "users"("id"),
  "assigned_at" timestamptz NOT NULL DEFAULT now(),
  "unassigned_at" timestamptz,
  "unassigned_by" uuid REFERENCES "users"("id")
);

CREATE INDEX IF NOT EXISTS "idx_tracker_assignments_active" ON "tracker_assignments" ("tracker_id", "unassigned_at");

-- ============================================================================
-- 10. gateways (references dealerships, lots)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "gateways" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dealership_id" uuid NOT NULL REFERENCES "dealerships"("id"),
  "lot_id" uuid REFERENCES "lots"("id"),
  "gateway_eui" text NOT NULL UNIQUE,
  "name" text,
  "latitude" numeric,
  "longitude" numeric,
  "backhaul_type" text,
  "status" text NOT NULL DEFAULT 'online',
  "last_seen_at" timestamptz,
  "firmware_version" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 11. location_history (TimescaleDB hypertable, no FK for performance)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "location_history" (
  "time" timestamptz NOT NULL,
  "tracker_id" uuid NOT NULL,
  "unit_id" uuid,
  "dealership_id" uuid NOT NULL,
  "latitude" numeric NOT NULL,
  "longitude" numeric NOT NULL,
  "accuracy_meters" numeric,
  "zone" text,
  "row_label" text,
  "spot_number" integer,
  "source" text,
  "gateway_id" uuid
);

SELECT create_hypertable('location_history', 'time', if_not_exists => TRUE);

-- ============================================================================
-- 12. movement_events (references units)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "movement_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "unit_id" uuid REFERENCES "units"("id"),
  "dealership_id" uuid NOT NULL,
  "from_zone" text,
  "from_row" text,
  "from_spot" integer,
  "to_zone" text,
  "to_row" text,
  "to_spot" integer,
  "distance_meters" numeric,
  "occurred_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 13. gateway_telemetry (TimescaleDB hypertable, no FK for performance)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "gateway_telemetry" (
  "time" timestamptz NOT NULL,
  "gateway_id" uuid NOT NULL,
  "cpu_temp_c" numeric,
  "memory_used_pct" numeric,
  "backhaul_latency_ms" numeric,
  "packets_received" integer,
  "packets_forwarded" integer
);

SELECT create_hypertable('gateway_telemetry', 'time', if_not_exists => TRUE);

-- ============================================================================
-- 14. geo_fences (references lots)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "geo_fences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lot_id" uuid REFERENCES "lots"("id"),
  "dealership_id" uuid NOT NULL,
  "name" text NOT NULL,
  "fence_type" text NOT NULL,
  "boundary" text,
  "color" text NOT NULL DEFAULT '#3B82F6',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "deleted_at" timestamptz
);

-- ============================================================================
-- 15. geo_fence_events (references geo_fences, units)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "geo_fence_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "geo_fence_id" uuid REFERENCES "geo_fences"("id"),
  "unit_id" uuid REFERENCES "units"("id"),
  "event_type" text NOT NULL,
  "occurred_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 16. alert_rules (references dealerships)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "alert_rules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dealership_id" uuid NOT NULL REFERENCES "dealerships"("id"),
  "rule_type" text NOT NULL,
  "parameters" jsonb,
  "severity" text NOT NULL DEFAULT 'warning',
  "channels" text,
  "recipient_roles" text,
  "recipient_user_ids" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 17. alerts (references alert_rules, units, trackers, gateways, geo_fences, users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "alerts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dealership_id" uuid NOT NULL,
  "rule_id" uuid REFERENCES "alert_rules"("id"),
  "alert_type" text NOT NULL,
  "severity" text NOT NULL,
  "title" text NOT NULL,
  "message" text,
  "unit_id" uuid REFERENCES "units"("id"),
  "tracker_id" uuid REFERENCES "trackers"("id"),
  "gateway_id" uuid REFERENCES "gateways"("id"),
  "geo_fence_id" uuid REFERENCES "geo_fences"("id"),
  "status" text NOT NULL DEFAULT 'new_alert',
  "acknowledged_by" uuid REFERENCES "users"("id"),
  "acknowledged_at" timestamptz,
  "snoozed_until" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_alerts_dealership_status_created" ON "alerts" ("dealership_id", "status", "created_at");

-- ============================================================================
-- 18. staging_plans (references lots)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "staging_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lot_id" uuid REFERENCES "lots"("id"),
  "dealership_id" uuid NOT NULL,
  "name" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT false,
  "is_template" boolean NOT NULL DEFAULT false,
  "rules" jsonb NOT NULL DEFAULT '[]',
  "activated_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 19. staging_assignments (references staging_plans, units, lot_spots)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "staging_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "plan_id" uuid NOT NULL REFERENCES "staging_plans"("id") ON DELETE CASCADE,
  "unit_id" uuid REFERENCES "units"("id"),
  "spot_id" uuid REFERENCES "lot_spots"("id"),
  "target_row" text NOT NULL,
  "target_spot" integer NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "priority" integer NOT NULL DEFAULT 0,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 20. work_orders (references units, users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "work_orders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dealership_id" uuid NOT NULL,
  "unit_id" uuid REFERENCES "units"("id"),
  "batch_id" uuid,
  "order_type" text NOT NULL,
  "priority" text NOT NULL DEFAULT 'normal',
  "status" text NOT NULL DEFAULT 'pending',
  "assigned_to" uuid REFERENCES "users"("id"),
  "notes" text,
  "due_date" date,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 21. unit_photos (references units, users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "unit_photos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "unit_id" uuid NOT NULL REFERENCES "units"("id") ON DELETE CASCADE,
  "url" text NOT NULL,
  "thumbnail_url" text,
  "uploaded_by" uuid REFERENCES "users"("id"),
  "is_primary" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 22. unit_notes (references units, users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "unit_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "unit_id" uuid NOT NULL REFERENCES "units"("id") ON DELETE CASCADE,
  "user_id" uuid REFERENCES "users"("id"),
  "content" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 23. audit_log (no FK enforced, for performance)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dealership_id" uuid NOT NULL,
  "user_id" uuid,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid,
  "changes" jsonb,
  "ip_address" text,
  "user_agent" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_audit_log_dealership_created" ON "audit_log" ("dealership_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_log_entity_created" ON "audit_log" ("entity_type", "entity_id", "created_at");

-- ============================================================================
-- 24. compliance_snapshots (references lots)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "compliance_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "lot_id" uuid NOT NULL REFERENCES "lots"("id"),
  "dealership_id" uuid NOT NULL,
  "total_tracked" integer NOT NULL DEFAULT 0,
  "in_correct_zone" integer NOT NULL DEFAULT 0,
  "score_pct" numeric NOT NULL DEFAULT '0',
  "snapshot_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 25. recalls (standalone)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "recalls" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dealership_id" uuid NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "affected_vins" text,
  "affected_makes" text,
  "affected_models" text,
  "affected_year_start" integer,
  "affected_year_end" integer,
  "status" text NOT NULL DEFAULT 'open',
  "matched_unit_count" integer NOT NULL DEFAULT 0,
  "batch_id" uuid,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 26. scheduled_reports (standalone)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "scheduled_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dealership_id" uuid NOT NULL,
  "report_type" text NOT NULL,
  "format" text NOT NULL DEFAULT 'pdf',
  "schedule" text NOT NULL,
  "recipients" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_run_at" timestamptz,
  "next_run_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 27. billing_events (standalone)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "billing_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dealership_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "stripe_event_id" text,
  "amount_cents" integer,
  "currency" text DEFAULT 'usd',
  "details" text,
  "processed_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 28. feature_flags (standalone)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "feature_flags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dealership_id" uuid NOT NULL,
  "feature" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT false,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "uq_feature_flags_dealership_feature" UNIQUE ("dealership_id", "feature")
);

-- ============================================================================
-- 29. api_keys (standalone)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dealership_id" uuid NOT NULL,
  "name" text NOT NULL,
  "key_hash" text NOT NULL UNIQUE,
  "key_prefix" text NOT NULL,
  "scopes" text NOT NULL DEFAULT 'read',
  "rate_limit_per_min" integer NOT NULL DEFAULT 100,
  "is_active" boolean NOT NULL DEFAULT true,
  "last_used_at" timestamptz,
  "expires_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 30. webhook_endpoints (standalone)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "webhook_endpoints" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dealership_id" uuid NOT NULL,
  "url" text NOT NULL,
  "secret" text NOT NULL,
  "events" text NOT NULL,
  "status" text NOT NULL DEFAULT 'active',
  "failure_count" integer NOT NULL DEFAULT 0,
  "last_triggered_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 31. webhook_deliveries (standalone)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "webhook_id" uuid NOT NULL,
  "event_type" text NOT NULL,
  "payload" text NOT NULL,
  "response_status" integer,
  "response_body" text,
  "success" boolean NOT NULL DEFAULT false,
  "attempted_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 32. dms_integrations (standalone)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "dms_integrations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dealership_id" uuid NOT NULL,
  "provider" text NOT NULL,
  "config" text NOT NULL DEFAULT '{}',
  "sync_status" text NOT NULL DEFAULT 'idle',
  "last_sync_at" timestamptz,
  "last_error" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 33. dms_sync_logs (standalone)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "dms_sync_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "integration_id" uuid NOT NULL,
  "direction" text NOT NULL,
  "units_created" integer NOT NULL DEFAULT 0,
  "units_updated" integer NOT NULL DEFAULT 0,
  "errors" integer NOT NULL DEFAULT 0,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz
);

-- ============================================================================
-- 34. unit_transfers (references units, dealerships)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "unit_transfers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "unit_id" uuid NOT NULL REFERENCES "units"("id"),
  "from_dealership_id" uuid NOT NULL REFERENCES "dealerships"("id"),
  "to_dealership_id" uuid NOT NULL REFERENCES "dealerships"("id"),
  "from_lot_id" uuid,
  "to_lot_id" uuid,
  "status" text NOT NULL DEFAULT 'initiated',
  "initiated_by" uuid NOT NULL,
  "notes" text,
  "departed_at" timestamptz,
  "arrived_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 35. widget_configs (standalone)
-- ============================================================================
CREATE TABLE IF NOT EXISTS "widget_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dealership_id" uuid NOT NULL UNIQUE,
  "theme_color" text NOT NULL DEFAULT '#3B82F6',
  "show_statuses" text NOT NULL DEFAULT 'available,lot_ready',
  "show_prices" boolean NOT NULL DEFAULT true,
  "link_template" text,
  "is_active" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
