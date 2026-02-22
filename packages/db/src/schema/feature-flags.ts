import {
  boolean,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const featureFlags = pgTable(
  'feature_flags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dealershipId: uuid('dealership_id').notNull(),
    feature: text('feature').notNull(),
    enabled: boolean('enabled').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('uq_feature_flags_dealership_feature').on(table.dealershipId, table.feature),
  ],
);
