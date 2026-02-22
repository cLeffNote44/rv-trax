import {
  date,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { units } from './units.js';
import { users } from './users.js';

// ---------------------------------------------------------------------------
// Work Orders
// ---------------------------------------------------------------------------

export const workOrders = pgTable('work_orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealershipId: uuid('dealership_id').notNull(),
  unitId: uuid('unit_id').references(() => units.id),
  batchId: uuid('batch_id'), // nullable, for batch operations
  orderType: text('order_type').notNull(),
  priority: text('priority').notNull().default('normal'),
  status: text('status').notNull().default('pending'),
  assignedTo: uuid('assigned_to').references(() => users.id),
  notes: text('notes'),
  dueDate: date('due_date'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_work_orders_dealership_status').on(table.dealershipId, table.status),
  index('idx_work_orders_unit').on(table.unitId),
]);
