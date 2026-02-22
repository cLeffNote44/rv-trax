import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { lots } from './lots.js';

// ---------------------------------------------------------------------------
// Staging Plans
// ---------------------------------------------------------------------------

export const stagingPlans = pgTable('staging_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  lotId: uuid('lot_id').references(() => lots.id),
  dealershipId: uuid('dealership_id').notNull(),
  name: text('name').notNull(),
  isActive: boolean('is_active').notNull().default(false),
  isTemplate: boolean('is_template').notNull().default(false),
  rules: jsonb('rules').notNull().default('[]'),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_staging_plans_dealership').on(table.dealershipId),
]);
