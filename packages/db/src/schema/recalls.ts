import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const recalls = pgTable('recalls', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealershipId: uuid('dealership_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  affectedVins: text('affected_vins'),
  affectedMakes: text('affected_makes'),       // comma-separated
  affectedModels: text('affected_models'),     // comma-separated
  affectedYearStart: integer('affected_year_start'),
  affectedYearEnd: integer('affected_year_end'),
  status: text('status').notNull().default('open'),
  matchedUnitCount: integer('matched_unit_count').notNull().default(0),
  batchId: uuid('batch_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_recalls_dealership').on(table.dealershipId, table.status),
]);
