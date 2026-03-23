import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { dealerships } from './dealerships.js';
import { lots } from './lots.js';
import { units } from './units.js';
import { workOrders } from './work-orders.js';
import { users } from './users.js';

// ---------------------------------------------------------------------------
// Service Bays — track units through service bays with time-in-bay metrics
// ---------------------------------------------------------------------------

export const serviceBays = pgTable(
  'service_bays',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dealershipId: uuid('dealership_id')
      .notNull()
      .references(() => dealerships.id),
    lotId: uuid('lot_id').references(() => lots.id),
    name: text('name').notNull(),
    bayType: text('bay_type').notNull().default('general'),
    status: text('status').notNull().default('available'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_service_bays_dealership').on(table.dealershipId, table.status)],
);

export const serviceBayAssignments = pgTable(
  'service_bay_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bayId: uuid('bay_id')
      .notNull()
      .references(() => serviceBays.id),
    workOrderId: uuid('work_order_id').references(() => workOrders.id),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => units.id),
    stage: text('stage').notNull().default('checked_in'),
    assignedBy: uuid('assigned_by').references(() => users.id),
    technicianId: uuid('technician_id').references(() => users.id),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true }).defaultNow().notNull(),
    stageChangedAt: timestamp('stage_changed_at', { withTimezone: true }).defaultNow().notNull(),
    checkedOutAt: timestamp('checked_out_at', { withTimezone: true }),
    totalMinutes: integer('total_minutes'),
    notes: text('notes'),
  },
  (table) => [
    index('idx_bay_assignments_bay').on(table.bayId),
    index('idx_bay_assignments_unit').on(table.unitId),
  ],
);
