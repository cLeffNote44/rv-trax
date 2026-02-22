import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { units } from './units.js';

// ---------------------------------------------------------------------------
// Location History (will be converted to TimescaleDB hypertable via raw SQL)
// ---------------------------------------------------------------------------

export const locationHistory = pgTable('location_history', {
  time: timestamp('time', { withTimezone: true }).notNull(),
  trackerId: uuid('tracker_id').notNull(),
  unitId: uuid('unit_id'),
  dealershipId: uuid('dealership_id').notNull(),
  latitude: numeric('latitude').notNull(),
  longitude: numeric('longitude').notNull(),
  accuracyMeters: numeric('accuracy_meters'),
  zone: text('zone'),
  rowLabel: text('row_label'),
  spotNumber: integer('spot_number'),
  source: text('source'),
  gatewayId: uuid('gateway_id'),
}, (table) => [
  index('idx_location_history_tracker_time').on(table.trackerId, table.time),
  index('idx_location_history_unit_time').on(table.unitId, table.time),
  index('idx_location_history_dealership_time').on(table.dealershipId, table.time),
]);

// ---------------------------------------------------------------------------
// Movement Events
// ---------------------------------------------------------------------------

export const movementEvents = pgTable('movement_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  unitId: uuid('unit_id').references(() => units.id),
  dealershipId: uuid('dealership_id').notNull(),
  fromZone: text('from_zone'),
  fromRow: text('from_row'),
  fromSpot: integer('from_spot'),
  toZone: text('to_zone'),
  toRow: text('to_row'),
  toSpot: integer('to_spot'),
  distanceMeters: numeric('distance_meters'),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_movement_events_unit').on(table.unitId, table.occurredAt),
  index('idx_movement_events_dealership').on(table.dealershipId, table.occurredAt),
]);
