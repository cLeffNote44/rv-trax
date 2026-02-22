import {
  integer,
  numeric,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { lots } from './lots.js';

export const complianceSnapshots = pgTable('compliance_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  lotId: uuid('lot_id').notNull().references(() => lots.id),
  dealershipId: uuid('dealership_id').notNull(),
  totalTracked: integer('total_tracked').notNull().default(0),
  inCorrectZone: integer('in_correct_zone').notNull().default(0),
  scorePct: numeric('score_pct').notNull().default('0'),
  snapshotAt: timestamp('snapshot_at', { withTimezone: true }).defaultNow().notNull(),
});
