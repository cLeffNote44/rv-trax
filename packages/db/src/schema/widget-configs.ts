import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const widgetConfigs = pgTable('widget_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealershipId: uuid('dealership_id').notNull().unique(),
  themeColor: text('theme_color').notNull().default('#3B82F6'),
  showStatuses: text('show_statuses').notNull().default('available,lot_ready'),
  showPrices: boolean('show_prices').notNull().default(true),
  linkTemplate: text('link_template'),
  isActive: boolean('is_active').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
