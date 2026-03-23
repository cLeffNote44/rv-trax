import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { dealerships } from './dealerships.js';
import { lots } from './lots.js';
import { units } from './units.js';
import { users } from './users.js';

// ---------------------------------------------------------------------------
// Floor Plan Audits — monthly inventory verification for floor plan lenders
// ---------------------------------------------------------------------------

export const floorPlanAudits = pgTable(
  'floor_plan_audits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dealershipId: uuid('dealership_id')
      .notNull()
      .references(() => dealerships.id),
    lotId: uuid('lot_id').references(() => lots.id),
    startedBy: uuid('started_by').references(() => users.id),
    status: text('status').notNull().default('pending'),
    totalUnits: integer('total_units').notNull().default(0),
    verifiedUnits: integer('verified_units').notNull().default(0),
    missingUnits: integer('missing_units').notNull().default(0),
    notes: text('notes'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('idx_floor_plan_audits_dealership').on(table.dealershipId, table.status)],
);

export const floorPlanAuditItems = pgTable(
  'floor_plan_audit_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    auditId: uuid('audit_id')
      .notNull()
      .references(() => floorPlanAudits.id, { onDelete: 'cascade' }),
    unitId: uuid('unit_id')
      .notNull()
      .references(() => units.id),
    status: text('status').notNull().default('pending'),
    expectedZone: text('expected_zone'),
    foundZone: text('found_zone'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: uuid('verified_by').references(() => users.id),
    notes: text('notes'),
    photoUrl: text('photo_url'),
  },
  (table) => [
    index('idx_audit_items_audit').on(table.auditId),
    index('idx_audit_items_unit').on(table.unitId),
  ],
);
