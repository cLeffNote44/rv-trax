import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const dmsIntegrations = pgTable('dms_integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealershipId: uuid('dealership_id').notNull(),
  provider: text('provider').notNull(),
  config: text('config').notNull().default('{}'),
  syncStatus: text('sync_status').notNull().default('idle'),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  lastError: text('last_error'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const dmsSyncLogs = pgTable('dms_sync_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationId: uuid('integration_id').notNull(),
  direction: text('direction').notNull(),
  unitsCreated: integer('units_created').notNull().default(0),
  unitsUpdated: integer('units_updated').notNull().default(0),
  errors: integer('errors').notNull().default(0),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});
