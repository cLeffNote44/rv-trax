import {
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { dealerships } from './dealerships.js';
import { lots } from './lots.js';

// ---------------------------------------------------------------------------
// Units (RVs / Inventory)
// ---------------------------------------------------------------------------

export const units = pgTable(
  'units',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dealershipId: uuid('dealership_id').notNull().references(() => dealerships.id),
    lotId: uuid('lot_id').references(() => lots.id),
    stockNumber: text('stock_number').notNull(),
    vin: text('vin'),
    year: integer('year'),
    make: text('make'),
    model: text('model'),
    floorplan: text('floorplan'),
    unitType: text('unit_type'),
    lengthFt: numeric('length_ft'),
    msrp: numeric('msrp'),
    status: text('status').notNull().default('new_arrival'),
    currentZone: text('current_zone'),
    currentRow: text('current_row'),
    currentSpot: integer('current_spot'),
    arrivedAt: timestamp('arrived_at', { withTimezone: true }).defaultNow(),
    soldAt: timestamp('sold_at', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    currentLat: numeric('current_lat'),
    currentLng: numeric('current_lng'),
    lastMovedAt: timestamp('last_moved_at', { withTimezone: true }),
    thumbnailUrl: text('thumbnail_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('uq_units_dealership_stock').on(table.dealershipId, table.stockNumber),
    index('idx_units_dealership_status').on(table.dealershipId, table.status),
    index('idx_units_vin').on(table.vin),
  ],
);
