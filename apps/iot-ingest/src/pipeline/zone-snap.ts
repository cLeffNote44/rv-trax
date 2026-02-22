// ---------------------------------------------------------------------------
// @rv-trax/iot-ingest — Pipeline Step 5: Zone snapping
// ---------------------------------------------------------------------------
//
// Snaps a position to the nearest lot spot (within 15m) and determines
// which geo-fence zone the point falls in.
// ---------------------------------------------------------------------------

import { eq, and } from 'drizzle-orm';
import { lotSpots, geoFences, type Database } from '@rv-trax/db';
import type { ZoneSnapResult } from './types.js';

// ── Constants ─────────────────────────────────────────────────────────────

/** Maximum snap distance in meters */
const MAX_SNAP_DISTANCE_M = 15;

/** Cache TTL for lot spots and geo-fence polygons (5 minutes) */
const CACHE_TTL_MS = 5 * 60 * 1000;

// ── Cache structures ──────────────────────────────────────────────────────

interface SpotData {
  id: string;
  rowLabel: string;
  spotNumber: number;
  centerLat: number;
  centerLng: number;
}

interface FenceData {
  id: string;
  name: string;
  fenceType: string;
  boundary: [number, number][];
}

interface LotCache {
  spots: SpotData[];
  fences: FenceData[];
  expiresAt: number;
}

const lotCacheMap = new Map<string, LotCache>();

/**
 * Clear the zone snap cache (useful for testing).
 */
export function clearZoneSnapCache(): void {
  lotCacheMap.clear();
}

// ── Cache loading ─────────────────────────────────────────────────────────

async function loadLotData(
  lotId: string,
  db: Database,
): Promise<{ spots: SpotData[]; fences: FenceData[] }> {
  const cached = lotCacheMap.get(lotId);
  if (cached && cached.expiresAt > Date.now()) {
    return { spots: cached.spots, fences: cached.fences };
  }

  // Load lot spots
  const spotRows = await db
    .select({
      id: lotSpots.id,
      rowLabel: lotSpots.rowLabel,
      spotNumber: lotSpots.spotNumber,
      centerLat: lotSpots.centerLat,
      centerLng: lotSpots.centerLng,
      isActive: lotSpots.isActive,
    })
    .from(lotSpots)
    .where(and(eq(lotSpots.lotId, lotId), eq(lotSpots.isActive, true)));

  const spots: SpotData[] = spotRows
    .filter((r) => r.centerLat !== null && r.centerLng !== null)
    .map((r) => ({
      id: r.id,
      rowLabel: r.rowLabel,
      spotNumber: r.spotNumber,
      centerLat: parseFloat(String(r.centerLat)),
      centerLng: parseFloat(String(r.centerLng)),
    }));

  // Load geo-fences for zone determination
  const fenceRows = await db
    .select({
      id: geoFences.id,
      name: geoFences.name,
      fenceType: geoFences.fenceType,
      boundary: geoFences.boundary,
      isActive: geoFences.isActive,
    })
    .from(geoFences)
    .where(and(eq(geoFences.lotId, lotId), eq(geoFences.isActive, true)));

  const fences: FenceData[] = fenceRows
    .filter((r) => r.boundary !== null)
    .map((r) => ({
      id: r.id,
      name: r.name,
      fenceType: r.fenceType,
      boundary: parseBoundary(r.boundary!),
    }))
    .filter((f) => f.boundary.length >= 3);

  // Update cache
  lotCacheMap.set(lotId, {
    spots,
    fences,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return { spots, fences };
}

// ── Main snap function ────────────────────────────────────────────────────

/**
 * Snap a position to the nearest lot spot (within 15m) and determine which
 * zone the point falls in.
 *
 * Returns:
 * - If a spot is within 15m: snapped to spot center, zone/row/spot populated
 * - If no spot within 15m: raw coordinates, zone from geo-fence containment test
 */
export async function snapToZone(
  lat: number,
  lng: number,
  lotId: string,
  db: Database,
): Promise<ZoneSnapResult> {
  const { spots, fences } = await loadLotData(lotId, db);

  // Find nearest spot
  let nearestSpot: SpotData | null = null;
  let nearestDistance = Infinity;

  for (const spot of spots) {
    const dist = haversineDistance(lat, lng, spot.centerLat, spot.centerLng);
    if (dist < nearestDistance) {
      nearestDistance = dist;
      nearestSpot = spot;
    }
  }

  // If nearest spot is within snap distance, use it
  if (nearestSpot && nearestDistance <= MAX_SNAP_DISTANCE_M) {
    return {
      zone: findContainingZone(nearestSpot.centerLat, nearestSpot.centerLng, fences),
      row: nearestSpot.rowLabel,
      spot: nearestSpot.spotNumber,
      snappedLat: nearestSpot.centerLat,
      snappedLng: nearestSpot.centerLng,
    };
  }

  // No spot within range — determine zone from geo-fences
  const zone = findContainingZone(lat, lng, fences);

  return {
    zone,
    row: null,
    spot: null,
    snappedLat: lat,
    snappedLng: lng,
  };
}

// ── Zone containment ──────────────────────────────────────────────────────

/**
 * Find which zone geo-fence contains the given point.
 * Prefers 'zone' type fences. Returns null if no match.
 */
function findContainingZone(
  lat: number,
  lng: number,
  fences: FenceData[],
): string | null {
  // Check zone-type fences first
  for (const fence of fences) {
    if (fence.fenceType === 'zone' && isPointInPolygon(lat, lng, fence.boundary)) {
      return fence.name;
    }
  }

  // Fall back to any fence type
  for (const fence of fences) {
    if (fence.fenceType !== 'zone' && isPointInPolygon(lat, lng, fence.boundary)) {
      return fence.name;
    }
  }

  return null;
}

// ── Haversine distance ───────────────────────────────────────────────────

/**
 * Calculate the distance in meters between two lat/lng points using Haversine.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ── Point-in-polygon (ray casting) ───────────────────────────────────────

/**
 * Ray casting algorithm: test if a point is inside a polygon.
 * polygon is an array of [lat, lng] pairs.
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

// ── Boundary parsing ─────────────────────────────────────────────────────

/**
 * Parse a boundary from its stored text format.
 * Handles JSON array of [lat, lng] pairs and GeoJSON Polygon format.
 */
function parseBoundary(boundary: string): [number, number][] {
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
        return ring.map((coord: number[]) => [coord[1], coord[0]] as [number, number]);
      }
    }

    return [];
  } catch {
    return [];
  }
}
