import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Dealership Groups
// ---------------------------------------------------------------------------

export const dealershipGroups = pgTable('dealership_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Dealerships
// ---------------------------------------------------------------------------

export const dealerships = pgTable('dealerships', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').references(() => dealershipGroups.id),
  name: text('name').notNull(),
  address: text('address').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  zip: text('zip').notNull(),
  timezone: text('timezone').notNull().default('America/New_York'),
  logoUrl: text('logo_url'),
  stripeCustomerId: text('stripe_customer_id'),
  subscriptionTier: text('subscription_tier').notNull().default('starter'),
  subscriptionStatus: text('subscription_status').notNull().default('active'),
  settings: jsonb('settings'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
