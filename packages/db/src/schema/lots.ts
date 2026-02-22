import {
  boolean,
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

// ---------------------------------------------------------------------------
// Lots
// ---------------------------------------------------------------------------

export const lots = pgTable('lots', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealershipId: uuid('dealership_id').notNull().references(() => dealerships.id),
  name: text('name').notNull(),
  address: text('address'),
  boundary: text('boundary'), // GeoJSON stored as text; PostGIS queries via raw SQL
  mapImageUrl: text('map_image_url'),
  totalSpots: integer('total_spots').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_lots_dealership').on(table.dealershipId),
]);

// ---------------------------------------------------------------------------
// Lot Spots
// ---------------------------------------------------------------------------

export const lotSpots = pgTable(
  'lot_spots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lotId: uuid('lot_id').notNull().references(() => lots.id, { onDelete: 'cascade' }),
    rowLabel: text('row_label').notNull(),
    spotNumber: integer('spot_number').notNull(),
    spotType: text('spot_type').notNull().default('standard'),
    centerLat: numeric('center_lat'),
    centerLng: numeric('center_lng'),
    widthFt: numeric('width_ft'),
    depthFt: numeric('depth_ft'),
    isActive: boolean('is_active').notNull().default(true),
  },
  (table) => [
    unique('uq_lot_spots_row_spot').on(table.lotId, table.rowLabel, table.spotNumber),
  ],
);
