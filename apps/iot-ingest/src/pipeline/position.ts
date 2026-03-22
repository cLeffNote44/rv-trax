// ---------------------------------------------------------------------------
// @rv-trax/iot-ingest — Pipeline Step 3: Position calculation
// ---------------------------------------------------------------------------

import type { Redis } from 'ioredis';
import type { LocationSource } from '@rv-trax/shared';
import type { TrackerEvent } from '../types.js';
import type { PositionResult, TrackerLookup } from './types.js';

/**
 * Calculate the best available position from a tracker event.
 *
 * Priority:
 * 1. GPS coordinates if available AND accuracy < 20m
 * 2. Gateway RSSI-weighted centroid if gateway location data is available
 * 3. Last known position from Redis (fallback)
 *
 * After computing position, validates that coordinates fall within the lot
 * boundary if one is defined.
 */
export async function calculatePosition(
  event: TrackerEvent,
  lookup: TrackerLookup,
  redis: Redis,
): Promise<PositionResult | null> {
  let result: PositionResult | null = null;

  // 1. Try GPS if we have coordinates and accuracy is reasonable
  //    When accuracy_meters is null (e.g. ChirpStack doesn't provide it),
  //    treat the GPS fix as valid with a default accuracy of 10m.
  if (
    event.latitude !== null &&
    event.longitude !== null &&
    (event.accuracy_meters === null || event.accuracy_meters < 20)
  ) {
    result = {
      latitude: event.latitude,
      longitude: event.longitude,
      accuracy: event.accuracy_meters ?? 10,
      source: 'gps' as LocationSource,
    };
  }

  // 2. If no good GPS, try gateway-based RSSI positioning
  if (!result && event.gateway_id) {
    const gatewayPosition = await getGatewayPosition(event.gateway_id, redis);

    if (gatewayPosition) {
      // Single gateway — use its position as approximate
      // RSSI-based accuracy estimate: map RSSI dBm to meters
      const accuracy = estimateAccuracyFromRssi(event.gateway_rssi);
      result = {
        latitude: gatewayPosition.lat,
        longitude: gatewayPosition.lng,
        accuracy,
        source: 'rssi' as LocationSource,
      };
    }
  }

  // 3. Fallback: use GPS coordinates even if accuracy is poor (>= 20m)
  if (!result && event.latitude !== null && event.longitude !== null) {
    result = {
      latitude: event.latitude,
      longitude: event.longitude,
      accuracy: event.accuracy_meters ?? 100,
      source: 'gps' as LocationSource,
    };
  }

  // 4. Last resort: use last known position from Redis
  if (!result) {
    const lastPos = await getLastKnownPosition(lookup.unit.id, redis);
    if (lastPos) {
      result = {
        latitude: lastPos.lat,
        longitude: lastPos.lng,
        accuracy: 999, // Unknown accuracy for stale data
        source: 'manual' as LocationSource,
      };
    }
  }

  if (!result) {
    return null; // No position available at all
  }

  // 5. Validate coordinates are within lot boundary if lot is defined
  if (lookup.lot?.boundary) {
    const boundary = parseBoundary(lookup.lot.boundary);
    if (boundary && boundary.length >= 3) {
      if (!isPointInPolygon(result.latitude, result.longitude, boundary)) {
        // Position is outside lot boundary — still return it but note the
        // discrepancy. Don't reject the data since the unit may have been
        // moved off-lot legitimately.
      }
    }
  }

  return result;
}

// ── Helper: gateway position lookup ──────────────────────────────────────

interface GatewayPos {
  lat: number;
  lng: number;
}

async function getGatewayPosition(
  gatewayId: string,
  redis: Redis,
): Promise<GatewayPos | null> {
  try {
    const data = await redis.hgetall(`gateway:${gatewayId}`);
    if (data.latitude && data.longitude) {
      const lat = parseFloat(data.latitude);
      const lng = parseFloat(data.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
  } catch {
    // Redis unavailable — fall through
  }
  return null;
}

// ── Helper: last known unit position from Redis ──────────────────────────

interface LastPosition {
  lat: number;
  lng: number;
}

async function getLastKnownPosition(
  unitId: string,
  redis: Redis,
): Promise<LastPosition | null> {
  try {
    const data = await redis.hgetall(`unit:${unitId}:position`);
    if (data.lat && data.lng) {
      const lat = parseFloat(data.lat);
      const lng = parseFloat(data.lng);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
  } catch {
    // Redis unavailable
  }
  return null;
}

// ── Helper: RSSI to accuracy mapping ─────────────────────────────────────

/**
 * Estimate position accuracy in meters based on RSSI signal strength.
 * Rough heuristic: stronger signal = closer to gateway = better accuracy.
 *
 * RSSI range:  -30 dBm (very close)  to  -120 dBm (far away)
 * Accuracy:     50m (close)           to   100m (far)
 */
function estimateAccuracyFromRssi(rssi: number): number {
  // Clamp RSSI to reasonable range
  const clamped = Math.max(-120, Math.min(-30, rssi));
  // Linear interpolation: -30 → 50m, -120 → 100m
  const t = (clamped - (-120)) / (-30 - (-120)); // 0 at -120, 1 at -30
  return 100 - t * 50; // 100m at far end, 50m at near end
}

// ── Helper: parse boundary string ────────────────────────────────────────

/**
 * Parse a lot boundary from its stored format.
 * Supports JSON array of [lat, lng] pairs or GeoJSON-style polygon.
 */
function parseBoundary(boundary: string): [number, number][] | null {
  try {
    const parsed = JSON.parse(boundary);

    // Direct array of [lat, lng] pairs
    if (Array.isArray(parsed) && parsed.length >= 3) {
      if (Array.isArray(parsed[0]) && parsed[0].length === 2) {
        return parsed as [number, number][];
      }
    }

    // GeoJSON Polygon: { type: "Polygon", coordinates: [[[lng, lat], ...]] }
    if (parsed.type === 'Polygon' && Array.isArray(parsed.coordinates)) {
      const ring = parsed.coordinates[0];
      if (Array.isArray(ring)) {
        // GeoJSON uses [lng, lat] — convert to [lat, lng]
        return ring.map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ── Helper: point-in-polygon (ray casting) ───────────────────────────────

/**
 * Ray casting algorithm to test if a point is inside a polygon.
 * Used for lot boundary validation.
 */
function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: [number, number][],
): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [yi, xi] = polygon[i]!;
    const [yj, xj] = polygon[j]!;

    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }

  return inside;
}
