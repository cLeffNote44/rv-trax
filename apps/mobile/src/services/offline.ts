// ---------------------------------------------------------------------------
// RV Trax Mobile — Offline Storage (op-sqlite)
// ---------------------------------------------------------------------------

import { open, type DB } from '@op-engineering/op-sqlite';
import type { Unit } from '@rv-trax/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PendingAction {
  id: string;
  type: 'status_change' | 'add_note' | 'assign_tracker';
  payload: Record<string, unknown>;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Database singleton
// ---------------------------------------------------------------------------

let db: DB | null = null;

function getDb(): DB {
  if (!db) {
    throw new Error('Offline DB not initialised — call initOfflineDb() first.');
  }
  return db;
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export async function initOfflineDb(): Promise<void> {
  db = open({ name: 'rvtrax_offline.db' });

  db.execute(`
    CREATE TABLE IF NOT EXISTS units_cache (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS pending_actions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      searched_at TEXT NOT NULL
    );
  `);

  db.execute(`
    CREATE TABLE IF NOT EXISTS map_tiles_meta (
      tile_key TEXT PRIMARY KEY,
      zoom INTEGER NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      cached_at TEXT NOT NULL
    );
  `);
}

// ---------------------------------------------------------------------------
// Units cache
// ---------------------------------------------------------------------------

export function cacheUnits(units: Unit[]): void {
  const d = getDb();
  const now = new Date().toISOString();

  d.execute('BEGIN TRANSACTION;');
  try {
    for (const unit of units) {
      d.execute(
        `INSERT OR REPLACE INTO units_cache (id, data, updated_at) VALUES (?, ?, ?);`,
        [unit.id, JSON.stringify(unit), now],
      );
    }
    d.execute('COMMIT;');
  } catch (e) {
    d.execute('ROLLBACK;');
    throw e;
  }
}

export function getCachedUnits(): Unit[] {
  const d = getDb();
  const result = d.execute('SELECT data FROM units_cache ORDER BY updated_at DESC;');
  const rows = (result.rows?._array ?? []) as Array<{ data: string }>;
  return rows.map((row) => JSON.parse(row.data) as Unit);
}

export function searchCachedUnits(query: string): Unit[] {
  const d = getDb();
  const likePattern = `%${query}%`;
  const result = d.execute(
    `SELECT data FROM units_cache
     WHERE data LIKE ? OR data LIKE ? OR data LIKE ? OR data LIKE ?
     ORDER BY updated_at DESC
     LIMIT 50;`,
    [
      `%"stock_number":"${likePattern}`,
      `%"vin":"${likePattern}`,
      `%"make":"${likePattern}`,
      `%"model":"${likePattern}`,
    ],
  );

  // Fallback: parse all and filter in JS for accuracy since JSON LIKE is
  // imprecise. The SQL query acts as a coarse first pass.
  const rows = (result.rows?._array ?? []) as Array<{ data: string }>;
  const lowerQuery = query.toLowerCase();

  return rows
    .map((row) => JSON.parse(row.data) as Unit)
    .filter(
      (u) =>
        u.stock_number.toLowerCase().includes(lowerQuery) ||
        (u.vin?.toLowerCase().includes(lowerQuery) ?? false) ||
        u.make.toLowerCase().includes(lowerQuery) ||
        u.model.toLowerCase().includes(lowerQuery),
    );
}

// ---------------------------------------------------------------------------
// Pending actions
// ---------------------------------------------------------------------------

export function queueAction(action: PendingAction): void {
  const d = getDb();
  d.execute(
    `INSERT INTO pending_actions (id, type, payload, created_at) VALUES (?, ?, ?, ?);`,
    [action.id, action.type, JSON.stringify(action.payload), action.created_at],
  );
}

export function getPendingActions(): PendingAction[] {
  const d = getDb();
  const result = d.execute(
    'SELECT id, type, payload, created_at FROM pending_actions ORDER BY created_at ASC;',
  );
  const rows = (result.rows?._array ?? []) as Array<{ id: string; type: string; payload: string; created_at: string }>;
  return rows.map((row) => ({
    id: row.id,
    type: row.type as PendingAction['type'],
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    created_at: row.created_at,
  }));
}

export function removePendingAction(id: string): void {
  const d = getDb();
  d.execute('DELETE FROM pending_actions WHERE id = ?;', [id]);
}

// ---------------------------------------------------------------------------
// Search history
// ---------------------------------------------------------------------------

export function saveSearchHistory(query: string): void {
  const d = getDb();
  const now = new Date().toISOString();
  // Remove duplicate before inserting so it floats to the top.
  d.execute('DELETE FROM search_history WHERE query = ?;', [query]);
  d.execute(
    'INSERT INTO search_history (query, searched_at) VALUES (?, ?);',
    [query, now],
  );
  // Keep only the 10 most recent.
  d.execute(
    `DELETE FROM search_history WHERE id NOT IN (
       SELECT id FROM search_history ORDER BY searched_at DESC LIMIT 10
     );`,
  );
}

export function getSearchHistory(): string[] {
  const d = getDb();
  const result = d.execute(
    'SELECT query FROM search_history ORDER BY searched_at DESC LIMIT 10;',
  );
  const rows = (result.rows?._array ?? []) as Array<{ query: string }>;
  return rows.map((row) => row.query);
}

export function clearSearchHistory(): void {
  const d = getDb();
  d.execute('DELETE FROM search_history;');
}
