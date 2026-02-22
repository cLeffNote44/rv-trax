import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { dealerships } from './dealerships.js';
import { units } from './units.js';
import { users } from './users.js';

// ---------------------------------------------------------------------------
// Trackers
// ---------------------------------------------------------------------------

export const trackers = pgTable('trackers', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealershipId: uuid('dealership_id').notNull().references(() => dealerships.id),
  deviceEui: text('device_eui').notNull().unique(),
  label: text('label'),
  firmwareVersion: text('firmware_version'),
  status: text('status').notNull().default('unassigned'),
  batteryPct: integer('battery_pct'),
  batteryMv: integer('battery_mv'),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  lastLatitude: numeric('last_latitude'),
  lastLongitude: numeric('last_longitude'),
  signalRssi: integer('signal_rssi'),
  retiredAt: timestamp('retired_at', { withTimezone: true }),
  retiredReason: text('retired_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_trackers_dealership').on(table.dealershipId),
]);

// ---------------------------------------------------------------------------
// Tracker Assignments
// ---------------------------------------------------------------------------

export const trackerAssignments = pgTable(
  'tracker_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trackerId: uuid('tracker_id').notNull().references(() => trackers.id),
    unitId: uuid('unit_id').notNull().references(() => units.id),
    assignedBy: uuid('assigned_by').references(() => users.id),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).defaultNow().notNull(),
    unassignedAt: timestamp('unassigned_at', { withTimezone: true }),
    unassignedBy: uuid('unassigned_by').references(() => users.id),
  },
  (table) => [
    index('idx_tracker_assignments_active').on(table.trackerId, table.unassignedAt),
  ],
);
