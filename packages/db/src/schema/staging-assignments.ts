import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { stagingPlans } from './staging.js';
import { units } from './units.js';
import { lotSpots } from './lots.js';

export const stagingAssignments = pgTable('staging_assignments', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').notNull().references(() => stagingPlans.id, { onDelete: 'cascade' }),
  unitId: uuid('unit_id').references(() => units.id),
  spotId: uuid('spot_id').references(() => lotSpots.id),
  targetRow: text('target_row').notNull(),
  targetSpot: integer('target_spot').notNull(),
  status: text('status').notNull().default('pending'),
  priority: integer('priority').notNull().default(0),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_staging_assignments_plan').on(table.planId),
  index('idx_staging_assignments_unit').on(table.unitId),
]);
