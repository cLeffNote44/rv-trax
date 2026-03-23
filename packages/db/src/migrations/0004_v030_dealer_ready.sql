-- v0.3.0 "Dealer Ready" — 6 new tables for staff activity, floor plan audits,
-- service bays, and dashboard configs.

-- ── Staff Activity Log ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "staff_activity_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dealership_id" uuid NOT NULL REFERENCES "dealerships"("id"),
  "user_id" uuid REFERENCES "users"("id"),
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_id" uuid,
  "entity_label" text,
  "metadata" jsonb,
  "ip_address" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_staff_activity_dealership_created"
  ON "staff_activity_log" ("dealership_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_staff_activity_user"
  ON "staff_activity_log" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_staff_activity_action"
  ON "staff_activity_log" ("dealership_id", "action");
CREATE INDEX IF NOT EXISTS "idx_staff_activity_entity"
  ON "staff_activity_log" ("entity_type", "entity_id");

-- ── Floor Plan Audits ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "floor_plan_audits" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dealership_id" uuid NOT NULL REFERENCES "dealerships"("id"),
  "lot_id" uuid REFERENCES "lots"("id"),
  "started_by" uuid REFERENCES "users"("id"),
  "status" text NOT NULL DEFAULT 'pending',
  "total_units" integer NOT NULL DEFAULT 0,
  "verified_units" integer NOT NULL DEFAULT 0,
  "missing_units" integer NOT NULL DEFAULT 0,
  "notes" text,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_floor_plan_audits_dealership"
  ON "floor_plan_audits" ("dealership_id", "status");

CREATE TABLE IF NOT EXISTS "floor_plan_audit_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "audit_id" uuid NOT NULL REFERENCES "floor_plan_audits"("id") ON DELETE CASCADE,
  "unit_id" uuid NOT NULL REFERENCES "units"("id"),
  "status" text NOT NULL DEFAULT 'pending',
  "expected_zone" text,
  "found_zone" text,
  "verified_at" timestamp with time zone,
  "verified_by" uuid REFERENCES "users"("id"),
  "notes" text,
  "photo_url" text
);

CREATE INDEX IF NOT EXISTS "idx_audit_items_audit"
  ON "floor_plan_audit_items" ("audit_id");
CREATE INDEX IF NOT EXISTS "idx_audit_items_unit"
  ON "floor_plan_audit_items" ("unit_id");

-- ── Service Bays ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "service_bays" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "dealership_id" uuid NOT NULL REFERENCES "dealerships"("id"),
  "lot_id" uuid REFERENCES "lots"("id"),
  "name" text NOT NULL,
  "bay_type" text NOT NULL DEFAULT 'general',
  "status" text NOT NULL DEFAULT 'available',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_service_bays_dealership"
  ON "service_bays" ("dealership_id", "status");

CREATE TABLE IF NOT EXISTS "service_bay_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "bay_id" uuid NOT NULL REFERENCES "service_bays"("id"),
  "work_order_id" uuid REFERENCES "work_orders"("id"),
  "unit_id" uuid NOT NULL REFERENCES "units"("id"),
  "stage" text NOT NULL DEFAULT 'checked_in',
  "assigned_by" uuid REFERENCES "users"("id"),
  "technician_id" uuid REFERENCES "users"("id"),
  "checked_in_at" timestamp with time zone DEFAULT now() NOT NULL,
  "stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "checked_out_at" timestamp with time zone,
  "total_minutes" integer,
  "notes" text
);

CREATE INDEX IF NOT EXISTS "idx_bay_assignments_bay"
  ON "service_bay_assignments" ("bay_id");
CREATE INDEX IF NOT EXISTS "idx_bay_assignments_unit"
  ON "service_bay_assignments" ("unit_id");

-- ── Dashboard Configs ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "dashboard_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "dealership_id" uuid NOT NULL REFERENCES "dealerships"("id"),
  "layout" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
