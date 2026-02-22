import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { units } from './units.js';
import { users } from './users.js';

// ---------------------------------------------------------------------------
// Unit Photos
// ---------------------------------------------------------------------------

export const unitPhotos = pgTable('unit_photos', {
  id: uuid('id').primaryKey().defaultRandom(),
  unitId: uuid('unit_id').notNull().references(() => units.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  uploadedBy: uuid('uploaded_by').references(() => users.id),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_unit_photos_unit').on(table.unitId),
]);

// ---------------------------------------------------------------------------
// Unit Notes
// ---------------------------------------------------------------------------

export const unitNotes = pgTable('unit_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  unitId: uuid('unit_id').notNull().references(() => units.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index('idx_unit_notes_unit').on(table.unitId),
]);
