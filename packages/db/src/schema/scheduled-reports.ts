import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const scheduledReports = pgTable('scheduled_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealershipId: uuid('dealership_id').notNull(),
  reportType: text('report_type').notNull(),
  format: text('format').notNull().default('pdf'),
  schedule: text('schedule').notNull(),
  recipients: text('recipients').notNull(),  // comma-separated emails
  isActive: boolean('is_active').notNull().default(true),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_scheduled_reports_dealership').on(table.dealershipId),
]);
