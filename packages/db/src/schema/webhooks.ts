import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealershipId: uuid('dealership_id').notNull(),
  url: text('url').notNull(),
  secret: text('secret').notNull(),
  events: text('events').notNull(),
  status: text('status').notNull().default('active'),
  failureCount: integer('failure_count').notNull().default(0),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  webhookId: uuid('webhook_id').notNull(),
  eventType: text('event_type').notNull(),
  payload: text('payload').notNull(),
  responseStatus: integer('response_status'),
  responseBody: text('response_body'),
  success: boolean('success').notNull().default(false),
  attemptedAt: timestamp('attempted_at', { withTimezone: true }).defaultNow().notNull(),
});
