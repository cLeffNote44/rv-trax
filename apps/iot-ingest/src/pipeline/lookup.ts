// ---------------------------------------------------------------------------
// @rv-trax/iot-ingest — Pipeline Step 1: Tracker/Unit lookup
// ---------------------------------------------------------------------------

import { eq, isNull, and } from 'drizzle-orm';
import {
  trackers,
  trackerAssignments,
  units,
  dealerships,
  lots,
  type Database,
} from '@rv-trax/db';
import type { TrackerLookup } from './types.js';

// ── In-memory cache ────────────────────────────────────────────────────────

interface CacheEntry {
  data: TrackerLookup | null;
  expiresAt: number;
}

const CACHE_TTL_MS = 60_000; // 60 seconds
const cache = new Map<string, CacheEntry>();

/**
 * Evict expired entries. Called lazily on each lookup to avoid unbounded growth.
 */
function evictExpired(): void {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

/**
 * Invalidate cache for a specific device EUI.
 */
export function invalidateCache(deviceEui: string): void {
  cache.delete(deviceEui);
}

/**
 * Clear entire lookup cache (useful for testing).
 */
export function clearLookupCache(): void {
  cache.clear();
}

// ── Main lookup ────────────────────────────────────────────────────────────

/**
 * Look up a tracker by device EUI and resolve its current assignment chain:
 * tracker -> tracker_assignments (active) -> unit -> dealership -> lot.
 *
 * Always updates tracker.last_seen_at regardless of assignment status.
 *
 * Returns null if:
 * - Tracker not found in database
 * - Tracker exists but has no active assignment
 */
export async function lookupTracker(
  deviceEui: string,
  db: Database,
): Promise<TrackerLookup | null> {
  // Check cache first
  evictExpired();
  const cached = cache.get(deviceEui);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // Query tracker
  const trackerRows = await db
    .select({
      id: trackers.id,
      deviceEui: trackers.deviceEui,
      dealershipId: trackers.dealershipId,
      batteryPct: trackers.batteryPct,
      batteryMv: trackers.batteryMv,
      signalRssi: trackers.signalRssi,
      lastSeenAt: trackers.lastSeenAt,
      status: trackers.status,
    })
    .from(trackers)
    .where(eq(trackers.deviceEui, deviceEui))
    .limit(1);

  if (trackerRows.length === 0) {
    // Unknown tracker — cache the miss briefly to avoid repeated DB hits
    cache.set(deviceEui, { data: null, expiresAt: Date.now() + CACHE_TTL_MS });
    return null;
  }

  const tracker = trackerRows[0]!;

  // Update last_seen_at unconditionally
  await db
    .update(trackers)
    .set({ lastSeenAt: new Date(), updatedAt: new Date() })
    .where(eq(trackers.id, tracker.id));

  // Find active assignment (unassigned_at IS NULL)
  const assignmentRows = await db
    .select({
      assignmentId: trackerAssignments.id,
      unitId: trackerAssignments.unitId,
    })
    .from(trackerAssignments)
    .where(
      and(
        eq(trackerAssignments.trackerId, tracker.id),
        isNull(trackerAssignments.unassignedAt),
      ),
    )
    .limit(1);

  if (assignmentRows.length === 0) {
    // Tracker exists but not assigned — cache as null
    cache.set(deviceEui, { data: null, expiresAt: Date.now() + CACHE_TTL_MS });
    return null;
  }

  const assignment = assignmentRows[0]!;

  // Fetch unit
  const unitRows = await db
    .select({
      id: units.id,
      dealershipId: units.dealershipId,
      lotId: units.lotId,
      stockNumber: units.stockNumber,
      currentZone: units.currentZone,
      currentRow: units.currentRow,
      currentSpot: units.currentSpot,
    })
    .from(units)
    .where(eq(units.id, assignment.unitId))
    .limit(1);

  if (unitRows.length === 0) {
    cache.set(deviceEui, { data: null, expiresAt: Date.now() + CACHE_TTL_MS });
    return null;
  }

  const unit = unitRows[0]!;

  // Fetch dealership
  const dealershipRows = await db
    .select({
      id: dealerships.id,
      name: dealerships.name,
      settings: dealerships.settings,
    })
    .from(dealerships)
    .where(eq(dealerships.id, unit.dealershipId))
    .limit(1);

  if (dealershipRows.length === 0) {
    cache.set(deviceEui, { data: null, expiresAt: Date.now() + CACHE_TTL_MS });
    return null;
  }

  const dealership = dealershipRows[0]!;

  // Fetch lot (optional — unit may not be on a lot)
  let lot: TrackerLookup['lot'] = null;
  if (unit.lotId) {
    const lotRows = await db
      .select({
        id: lots.id,
        name: lots.name,
        boundary: lots.boundary,
      })
      .from(lots)
      .where(eq(lots.id, unit.lotId))
      .limit(1);

    if (lotRows.length > 0) {
      lot = lotRows[0] ?? null;
    }
  }

  const result: TrackerLookup = {
    tracker: {
      id: tracker.id,
      deviceEui: tracker.deviceEui,
      dealershipId: tracker.dealershipId,
      batteryPct: tracker.batteryPct,
      batteryMv: tracker.batteryMv,
      signalRssi: tracker.signalRssi,
      lastSeenAt: tracker.lastSeenAt,
      status: tracker.status,
    },
    unit: {
      id: unit.id,
      dealershipId: unit.dealershipId,
      lotId: unit.lotId,
      stockNumber: unit.stockNumber,
      currentZone: unit.currentZone,
      currentRow: unit.currentRow,
      currentSpot: unit.currentSpot,
    },
    dealership: {
      id: dealership.id,
      name: dealership.name,
      settings: dealership.settings as Record<string, unknown> | null,
    },
    lot,
    assignmentId: assignment.assignmentId,
  };

  cache.set(deviceEui, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
  return result;
}
