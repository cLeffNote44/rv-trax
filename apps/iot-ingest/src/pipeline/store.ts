// ---------------------------------------------------------------------------
// @rv-trax/iot-ingest — Pipeline Steps 8-11: Data storage & broadcasting
// ---------------------------------------------------------------------------

import { eq } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import {
  units,
  locationHistory,
  movementEvents,
  type Database,
} from '@rv-trax/db';
import type { TrackerEvent } from '../types.js';
import type { PositionResult, MovementResult, ZoneSnapResult } from './types.js';

// ── Throttle tracking for history writes ──────────────────────────────────

/** Minimum interval between history writes for the same unit (5 minutes) */
const HISTORY_MIN_INTERVAL_MS = 5 * 60 * 1000;

// ── Step 8: Update live location in Redis ─────────────────────────────────

/**
 * Update the live location in Redis hashes for both the tracker and the unit,
 * and update the unit's current zone/row/spot in the database.
 */
export async function updateLiveLocation(
  deviceEui: string,
  _trackerId: string,
  unitId: string,
  lat: number,
  lng: number,
  zone: string | null,
  row: string | null,
  spot: number | null,
  redis: Redis,
  db: Database,
): Promise<void> {
  const now = new Date().toISOString();

  const locationData: Record<string, string> = {
    lat: lat.toString(),
    lng: lng.toString(),
    zone: zone ?? '',
    row: row ?? '',
    spot: spot !== null ? spot.toString() : '',
    timestamp: now,
  };

  // Update Redis hashes (parallel)
  await Promise.all([
    redis
      .hmset(`tracker:${deviceEui}`, locationData)
      .catch((err) => console.error('[store] Failed to update tracker hash:', err)),
    redis
      .hmset(`unit:${unitId}:position`, locationData)
      .catch((err) => console.error('[store] Failed to update unit hash:', err)),
  ]);

  // Set TTL on Redis keys (24 hours — prevent stale data from lingering)
  await Promise.all([
    redis.expire(`tracker:${deviceEui}`, 86400).catch(() => {}),
    redis.expire(`unit:${unitId}:position`, 86400).catch(() => {}),
  ]);

  // Update unit table with current position
  await db
    .update(units)
    .set({
      currentZone: zone,
      currentRow: row,
      currentSpot: spot,
      updatedAt: new Date(),
    })
    .where(eq(units.id, unitId))
    .catch((err) => {
      console.error('[store] Failed to update unit zone/row/spot:', err);
    });
}

// ── Step 9: Store location history ────────────────────────────────────────

/**
 * Insert a location history record into the TimescaleDB hypertable.
 *
 * Throttled: only writes if the unit moved OR it has been more than 5 minutes
 * since the last history write for this unit.
 */
export async function storeLocationHistory(
  event: TrackerEvent,
  trackerId: string,
  unitId: string,
  dealershipId: string,
  position: PositionResult,
  zoneSnap: ZoneSnapResult | null,
  moved: boolean,
  redis: Redis,
  db: Database,
): Promise<boolean> {
  // Check throttle — skip if not moved and too recent
  if (!moved) {
    try {
      const lastWrite = await redis.get(`history:last:${unitId}`);
      if (lastWrite) {
        const elapsed = Date.now() - parseInt(lastWrite, 10);
        if (elapsed < HISTORY_MIN_INTERVAL_MS) {
          return false; // Throttled
        }
      }
    } catch {
      // Redis unavailable — proceed with write
    }
  }

  // Insert location history
  await db
    .insert(locationHistory)
    .values({
      time: new Date(event.timestamp),
      trackerId,
      unitId,
      dealershipId,
      latitude: position.latitude.toString(),
      longitude: position.longitude.toString(),
      accuracyMeters: position.accuracy.toString(),
      zone: zoneSnap?.zone ?? null,
      rowLabel: zoneSnap?.row ?? null,
      spotNumber: zoneSnap?.spot ?? null,
      source: position.source,
      gatewayId: event.gateway_id || null,
    });

  // Update throttle timestamp
  try {
    await redis.set(
      `history:last:${unitId}`,
      Date.now().toString(),
      'EX',
      600, // TTL 10 minutes
    );
  } catch {
    // Non-fatal
  }

  return true;
}

// ── Step 10: Broadcast location update ────────────────────────────────────

/**
 * Publish a location update to the dealership's location channel via Redis
 * pub/sub. Connected WebSocket servers subscribe to this channel and relay
 * updates to the browser clients.
 */
export async function broadcastUpdate(
  dealershipId: string,
  unitId: string,
  lat: number,
  lng: number,
  zone: string | null,
  row: string | null,
  spot: number | null,
  moved: boolean,
  redis: Redis,
): Promise<void> {
  const payload = JSON.stringify({
    unit_id: unitId,
    lat,
    lng,
    zone,
    row,
    spot,
    moved,
    timestamp: new Date().toISOString(),
  });

  await redis
    .publish(`dealership:${dealershipId}:locations`, payload)
    .catch((err) => {
      console.error('[store] Failed to broadcast location update:', err);
    });
}

// ── Step 11: Log movement event ───────────────────────────────────────────

/**
 * Insert a movement event record when a unit changes zone/row/spot.
 */
export async function logMovementEvent(
  movement: MovementResult,
  unitId: string,
  dealershipId: string,
  db: Database,
): Promise<void> {
  if (!movement.moved) return;

  await db
    .insert(movementEvents)
    .values({
      unitId,
      dealershipId,
      fromZone: movement.fromZone,
      fromRow: movement.fromRow,
      fromSpot: movement.fromSpot,
      toZone: movement.toZone,
      toRow: movement.toRow,
      toSpot: movement.toSpot,
      distanceMeters: movement.distance.toString(),
      occurredAt: new Date(),
    })
    .catch((err) => {
      console.error('[store] Failed to log movement event:', err);
    });

  // Update unit's last_moved_at via raw field update
  await db
    .update(units)
    .set({ updatedAt: new Date() })
    .where(eq(units.id, unitId))
    .catch(() => {});
}
