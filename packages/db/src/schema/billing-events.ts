import {
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const billingEvents = pgTable('billing_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealershipId: uuid('dealership_id').notNull(),
  eventType: text('event_type').notNull(),
  stripeEventId: text('stripe_event_id'),
  amountCents: integer('amount_cents'),
  currency: text('currency').default('usd'),
  details: text('details'),  // JSON string for extra data
  processedAt: timestamp('processed_at', { withTimezone: true }).defaultNow().notNull(),
});
