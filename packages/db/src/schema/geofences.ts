import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { lots } from './lots.js';
import { units } from './units.js';

// ---------------------------------------------------------------------------
// Geo-Fences
// ---------------------------------------------------------------------------

export const geoFences = pgTable('geo_fences', {
  id: uuid('id').primaryKey().defaultRandom(),
  lotId: uuid('lot_id').references(() => lots.id),
  dealershipId: uuid('dealership_id').notNull(),
  name: text('name').notNull(),
  fenceType: text('fence_type').notNull(),
  boundary: text('boundary'), // GeoJSON stored as text
  color: text('color').notNull().default('#3B82F6'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_geofences_dealership').on(table.dealershipId),
]);

// ---------------------------------------------------------------------------
// Geo-Fence Events
// ---------------------------------------------------------------------------

export const geoFenceEvents = pgTable('geo_fence_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  geoFenceId: uuid('geo_fence_id').references(() => geoFences.id),
  unitId: uuid('unit_id').references(() => units.id),
  eventType: text('event_type').notNull(), // 'enter' | 'exit'
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_geofence_events_geofence').on(table.geoFenceId),
]);
