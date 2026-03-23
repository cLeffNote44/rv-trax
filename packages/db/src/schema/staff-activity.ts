import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { dealerships } from './dealerships.js';
import { users } from './users.js';

// ---------------------------------------------------------------------------
// Staff Activity Log — tracks who did what and when across the dealership
// ---------------------------------------------------------------------------

export const staffActivityLog = pgTable(
  'staff_activity_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dealershipId: uuid('dealership_id')
      .notNull()
      .references(() => dealerships.id),
    userId: uuid('user_id').references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    entityLabel: text('entity_label'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_staff_activity_dealership_created').on(table.dealershipId, table.createdAt),
    index('idx_staff_activity_user').on(table.userId),
    index('idx_staff_activity_action').on(table.dealershipId, table.action),
    index('idx_staff_activity_entity').on(table.entityType, table.entityId),
  ],
);
