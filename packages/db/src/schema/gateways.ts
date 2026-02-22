import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { dealerships } from './dealerships.js';
import { lots } from './lots.js';

// ---------------------------------------------------------------------------
// Gateways
// ---------------------------------------------------------------------------

export const gateways = pgTable('gateways', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealershipId: uuid('dealership_id').notNull().references(() => dealerships.id),
  lotId: uuid('lot_id').references(() => lots.id),
  gatewayEui: text('gateway_eui').notNull().unique(),
  name: text('name'),
  latitude: numeric('latitude'),
  longitude: numeric('longitude'),
  backhaulType: text('backhaul_type'),
  status: text('status').notNull().default('online'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  firmwareVersion: text('firmware_version'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_gateways_dealership').on(table.dealershipId),
]);
