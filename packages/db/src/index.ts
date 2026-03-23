// ---------------------------------------------------------------------------
// @rv-trax/db — Public API
// ---------------------------------------------------------------------------

export { createDb, type Database } from './connection.js';

// Schema tables
export * from './schema/dealerships.js';
export * from './schema/users.js';
export * from './schema/lots.js';
export * from './schema/units.js';
export * from './schema/trackers.js';
export * from './schema/gateways.js';
export * from './schema/locations.js';
export * from './schema/geofences.js';
export * from './schema/alerts.js';
export * from './schema/staging.js';
export * from './schema/work-orders.js';
export * from './schema/unit-extras.js';
export * from './schema/audit.js';
export * from './schema/gateway-telemetry.js';
export * from './schema/staging-assignments.js';
export * from './schema/compliance-snapshots.js';
export * from './schema/recalls.js';
export * from './schema/scheduled-reports.js';
export * from './schema/billing-events.js';
export * from './schema/feature-flags.js';
export * from './schema/api-keys.js';
export * from './schema/webhooks.js';
export * from './schema/dms-integrations.js';
export * from './schema/transfers.js';
export * from './schema/widget-configs.js';
export * from './schema/device-tokens.js';
export * from './schema/staff-activity.js';
export * from './schema/floor-plan-audits.js';
export * from './schema/service-bays.js';
export * from './schema/dashboard-configs.js';
