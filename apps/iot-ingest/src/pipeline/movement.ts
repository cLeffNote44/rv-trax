// ---------------------------------------------------------------------------
// @rv-trax/iot-ingest — Pipeline Step 6: Movement detection
// ---------------------------------------------------------------------------

import type { Redis } from 'ioredis';
import type { MovementResult } from './types.js';
import { haversineDistance } from './zone-snap.js';

/** Minimum distance in meters to consider as actual movement (GPS jitter filter) */
const MOVEMENT_THRESHOLD_M = 5;

/**
 * Detect whether a unit has moved by comparing its new position and zone
 * assignment against the last known state stored in Redis.
 *
 * Movement is detected when:
 * - Distance exceeds 5 meters AND (zone changed OR row changed OR spot changed)
 *
 * This dual-condition prevents false movement reports from normal GPS jitter
 * while still catching real zone transitions even at short distances.
 */
export async function detectMovement(
  unitId: string,
  newLat: number,
  newLng: number,
  newZone: string | null,
  newRow: string | null,
  newSpot: number | null,
  redis: Redis,
): Promise<MovementResult> {
  // Get last known position from Redis
  let fromLat: number | null = null;
  let fromLng: number | null = null;
  let fromZone: string | null = null;
  let fromRow: string | null = null;
  let fromSpot: number | null = null;

  try {
    const data = await redis.hgetall(`unit:${unitId}:position`);
    if (data.lat && data.lng) {
      fromLat = parseFloat(data.lat);
      fromLng = parseFloat(data.lng);
      fromZone = data.zone || null;
      fromRow = data.row || null;
      fromSpot = data.spot ? parseInt(data.spot, 10) : null;

      if (isNaN(fromLat) || isNaN(fromLng)) {
        fromLat = null;
        fromLng = null;
      }
      if (fromSpot !== null && isNaN(fromSpot)) {
        fromSpot = null;
      }
    }
  } catch {
    // Redis unavailable — treat as no previous position
  }

  // If no previous position, this is the first report — not a "move"
  if (fromLat === null || fromLng === null) {
    return {
      moved: false,
      distance: 0,
      fromZone: null,
      fromRow: null,
      fromSpot: null,
      fromLat: null,
      fromLng: null,
      toZone: newZone,
      toRow: newRow,
      toSpot: newSpot,
    };
  }

  // Calculate distance
  const distance = haversineDistance(fromLat, fromLng, newLat, newLng);

  // Check if zone/row/spot changed
  const zoneChanged = fromZone !== newZone;
  const rowChanged = fromRow !== newRow;
  const spotChanged = fromSpot !== newSpot;
  const locationChanged = zoneChanged || rowChanged || spotChanged;

  // Movement = distance > threshold AND location assignment changed
  const moved = distance > MOVEMENT_THRESHOLD_M && locationChanged;

  return {
    moved,
    distance: Math.round(distance * 100) / 100, // Round to cm precision
    fromZone,
    fromRow,
    fromSpot,
    fromLat,
    fromLng,
    toZone: newZone,
    toRow: newRow,
    toSpot: newSpot,
  };
}
