import type { FastifyInstance } from 'fastify';
import { sql } from 'drizzle-orm';

const TABLES = [
  'widget_configs', 'unit_transfers', 'dms_sync_logs', 'dms_integrations',
  'webhook_deliveries', 'webhook_endpoints', 'api_keys', 'feature_flags',
  'billing_events', 'scheduled_reports', 'recalls', 'compliance_snapshots',
  'audit_log', 'unit_notes', 'unit_photos', 'work_orders',
  'staging_assignments', 'staging_plans', 'alerts', 'alert_rules',
  'geo_fence_events', 'geo_fences', 'gateway_telemetry', 'movement_events',
  'location_history', 'gateways', 'tracker_assignments', 'trackers',
  'units', 'lot_spots', 'lots', 'refresh_tokens', 'device_tokens', 'users',
  'dealerships', 'dealership_groups',
];

export async function cleanDatabase(app: FastifyInstance): Promise<void> {
  // Use TRUNCATE CASCADE for speed
  await app.db.execute(sql.raw(`TRUNCATE TABLE ${TABLES.map(t => `"${t}"`).join(', ')} CASCADE`));
}
