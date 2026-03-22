import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as dealerships from './schema/dealerships.js';
import * as users from './schema/users.js';
import * as lots from './schema/lots.js';
import * as units from './schema/units.js';
import * as trackers from './schema/trackers.js';
import * as gateways from './schema/gateways.js';
import * as locations from './schema/locations.js';
import * as geofences from './schema/geofences.js';
import * as alerts from './schema/alerts.js';
import * as staging from './schema/staging.js';
import * as workOrders from './schema/work-orders.js';
import * as unitExtras from './schema/unit-extras.js';
import * as audit from './schema/audit.js';
import * as gatewayTelemetry from './schema/gateway-telemetry.js';
import * as stagingAssignments from './schema/staging-assignments.js';
import * as complianceSnapshots from './schema/compliance-snapshots.js';
import * as recalls from './schema/recalls.js';
import * as scheduledReports from './schema/scheduled-reports.js';
import * as billingEvents from './schema/billing-events.js';
import * as featureFlags from './schema/feature-flags.js';
import * as apiKeys from './schema/api-keys.js';
import * as webhooks from './schema/webhooks.js';
import * as dmsIntegrations from './schema/dms-integrations.js';
import * as transfers from './schema/transfers.js';
import * as widgetConfigs from './schema/widget-configs.js';
import * as deviceTokens from './schema/device-tokens.js';

const schema = {
  ...dealerships,
  ...users,
  ...lots,
  ...units,
  ...trackers,
  ...gateways,
  ...locations,
  ...geofences,
  ...alerts,
  ...staging,
  ...workOrders,
  ...unitExtras,
  ...audit,
  ...gatewayTelemetry,
  ...stagingAssignments,
  ...complianceSnapshots,
  ...recalls,
  ...scheduledReports,
  ...billingEvents,
  ...featureFlags,
  ...apiKeys,
  ...webhooks,
  ...dmsIntegrations,
  ...transfers,
  ...widgetConfigs,
  ...deviceTokens,
};

export interface DbOptions {
  /** Max connections in pool (default: 10) */
  max?: number;
  /** Idle connection timeout in seconds (default: 30) */
  idleTimeout?: number;
  /** Connection timeout in seconds (default: 10) */
  connectTimeout?: number;
  /** Enable SSL (default: false) */
  ssl?: boolean;
}

export function createDb(url: string, options?: DbOptions) {
  const client = postgres(url, {
    max: options?.max ?? 10,
    idle_timeout: options?.idleTimeout ?? 30,
    connect_timeout: options?.connectTimeout ?? 10,
    ssl: options?.ssl ? 'require' : undefined,
  });
  const db = drizzle(client, { schema });
  return { db, client };
}

export type Database = ReturnType<typeof createDb>['db'];
