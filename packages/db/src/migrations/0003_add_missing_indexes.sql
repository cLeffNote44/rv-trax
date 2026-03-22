-- 0003_add_missing_indexes.sql
-- Catch-up migration: adds all indexes defined in the Drizzle schema files
-- that were not included in previous migrations (0000_initial.sql and onward).
-- Every statement uses IF NOT EXISTS so this migration is safe to re-run.

-- ============================================================================
-- users
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_users_dealership"
  ON "users" ("dealership_id");

-- ============================================================================
-- refresh_tokens
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_refresh_tokens_user"
  ON "refresh_tokens" ("user_id");

-- ============================================================================
-- lots
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_lots_dealership"
  ON "lots" ("dealership_id");

-- ============================================================================
-- trackers
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_trackers_dealership"
  ON "trackers" ("dealership_id");

-- ============================================================================
-- gateways
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_gateways_dealership"
  ON "gateways" ("dealership_id");

-- ============================================================================
-- location_history (TimescaleDB hypertable)
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_location_history_tracker_time"
  ON "location_history" ("tracker_id", "time");

CREATE INDEX IF NOT EXISTS "idx_location_history_unit_time"
  ON "location_history" ("unit_id", "time");

CREATE INDEX IF NOT EXISTS "idx_location_history_dealership_time"
  ON "location_history" ("dealership_id", "time");

-- ============================================================================
-- movement_events
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_movement_events_unit"
  ON "movement_events" ("unit_id", "occurred_at");

CREATE INDEX IF NOT EXISTS "idx_movement_events_dealership"
  ON "movement_events" ("dealership_id", "occurred_at");

-- ============================================================================
-- geo_fences
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_geofences_dealership"
  ON "geo_fences" ("dealership_id");

-- ============================================================================
-- geo_fence_events
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_geofence_events_geofence"
  ON "geo_fence_events" ("geo_fence_id");

-- ============================================================================
-- staging_plans
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_staging_plans_dealership"
  ON "staging_plans" ("dealership_id");

-- ============================================================================
-- staging_assignments
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_staging_assignments_plan"
  ON "staging_assignments" ("plan_id");

CREATE INDEX IF NOT EXISTS "idx_staging_assignments_unit"
  ON "staging_assignments" ("unit_id");

-- ============================================================================
-- work_orders
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_work_orders_dealership_status"
  ON "work_orders" ("dealership_id", "status");

CREATE INDEX IF NOT EXISTS "idx_work_orders_unit"
  ON "work_orders" ("unit_id");

-- ============================================================================
-- unit_photos
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_unit_photos_unit"
  ON "unit_photos" ("unit_id");

-- ============================================================================
-- unit_notes
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_unit_notes_unit"
  ON "unit_notes" ("unit_id");

-- ============================================================================
-- scheduled_reports
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_scheduled_reports_dealership"
  ON "scheduled_reports" ("dealership_id");

-- ============================================================================
-- recalls
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_recalls_dealership"
  ON "recalls" ("dealership_id", "status");

-- ============================================================================
-- unit_transfers
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_transfers_from_dealership"
  ON "unit_transfers" ("from_dealership_id");

CREATE INDEX IF NOT EXISTS "idx_transfers_to_dealership"
  ON "unit_transfers" ("to_dealership_id");

-- ============================================================================
-- device_tokens
-- ============================================================================
CREATE INDEX IF NOT EXISTS "idx_device_tokens_user"
  ON "device_tokens" ("user_id");
