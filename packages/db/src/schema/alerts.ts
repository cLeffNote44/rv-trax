import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { dealerships } from './dealerships.js';
import { units } from './units.js';
import { trackers } from './trackers.js';
import { gateways } from './gateways.js';
import { geoFences } from './geofences.js';
import { users } from './users.js';

// ---------------------------------------------------------------------------
// Alert Rules
// ---------------------------------------------------------------------------

export const alertRules = pgTable('alert_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  dealershipId: uuid('dealership_id').notNull().references(() => dealerships.id),
  ruleType: text('rule_type').notNull(),
  parameters: jsonb('parameters'),
  severity: text('severity').notNull().default('warning'),
  channels: text('channels'), // comma-separated or jsonb array
  recipientRoles: text('recipient_roles'),
  recipientUserIds: text('recipient_user_ids'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export const alerts = pgTable(
  'alerts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dealershipId: uuid('dealership_id').notNull(),
    ruleId: uuid('rule_id').references(() => alertRules.id),
    alertType: text('alert_type').notNull(),
    severity: text('severity').notNull(),
    title: text('title').notNull(),
    message: text('message'),
    unitId: uuid('unit_id').references(() => units.id),
    trackerId: uuid('tracker_id').references(() => trackers.id),
    gatewayId: uuid('gateway_id').references(() => gateways.id),
    geoFenceId: uuid('geo_fence_id').references(() => geoFences.id),
    status: text('status').notNull().default('new_alert'),
    acknowledgedBy: uuid('acknowledged_by').references(() => users.id),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    snoozedUntil: timestamp('snoozed_until', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('idx_alerts_dealership_status_created').on(
      table.dealershipId,
      table.status,
      table.createdAt,
    ),
  ],
);
