import { jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { dealerships } from './dealerships.js';
import { users } from './users.js';

// ---------------------------------------------------------------------------
// Dashboard Configs — per-user customizable widget layouts
// ---------------------------------------------------------------------------

export interface DashboardWidget {
  widget_id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config?: Record<string, unknown>;
}

export const dashboardConfigs = pgTable('dashboard_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  dealershipId: uuid('dealership_id')
    .notNull()
    .references(() => dealerships.id),
  layout: jsonb('layout').$type<DashboardWidget[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
