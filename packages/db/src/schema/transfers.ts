import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { units } from './units.js';
import { dealerships } from './dealerships.js';

export const unitTransfers = pgTable('unit_transfers', {
  id: uuid('id').primaryKey().defaultRandom(),
  unitId: uuid('unit_id').notNull().references(() => units.id),
  fromDealershipId: uuid('from_dealership_id').notNull().references(() => dealerships.id),
  toDealershipId: uuid('to_dealership_id').notNull().references(() => dealerships.id),
  fromLotId: uuid('from_lot_id'),
  toLotId: uuid('to_lot_id'),
  status: text('status').notNull().default('initiated'),
  initiatedBy: uuid('initiated_by').notNull(),
  notes: text('notes'),
  departedAt: timestamp('departed_at', { withTimezone: true }),
  arrivedAt: timestamp('arrived_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_transfers_from_dealership').on(table.fromDealershipId),
  index('idx_transfers_to_dealership').on(table.toDealershipId),
]);
