// ---------------------------------------------------------------------------
// RV Trax Mobile — Geo Utilities
// ---------------------------------------------------------------------------

import type { UnitStatus } from '@rv-trax/shared';

// ---------------------------------------------------------------------------
// Status colours
// ---------------------------------------------------------------------------

const STATUS_COLOR_MAP: Record<string, string> = {
  new_arrival: '#3B82F6',      // blue
  pdi_pending: '#8B5CF6',      // purple
  pdi_in_progress: '#A855F7',  // violet
  lot_ready: '#06B6D4',        // cyan
  available: '#22C55E',        // green
  hold: '#F97316',             // orange
  shown: '#F59E0B',            // amber
  deposit: '#10B981',          // emerald
  sold: '#EF4444',             // red
  pending_delivery: '#F97316', // orange
  delivered: '#6B7280',        // gray
  in_service: '#EAB308',       // yellow
  wholesale: '#78716C',        // stone
  archived: '#9CA3AF',         // gray-400
};

/**
 * Map a `UnitStatus` value to a hex colour for map markers, badges, etc.
 */
export function getStatusColor(status: UnitStatus): string {
  return STATUS_COLOR_MAP[status] ?? '#6B7280';
}

// ---------------------------------------------------------------------------
// Haversine distance
// ---------------------------------------------------------------------------

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Calculate the distance in metres between two lat/lng points using the
 * Haversine formula.
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

// ---------------------------------------------------------------------------
// Point-in-polygon (ray casting)
// ---------------------------------------------------------------------------

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * Determine whether a point lies inside a polygon using the ray-casting
 * algorithm.
 */
export function isPointInPolygon(point: GeoPoint, polygon: GeoPoint[]): boolean {
  const { latitude: x, longitude: y } = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].latitude;
    const yi = polygon[i].longitude;
    const xj = polygon[j].latitude;
    const yj = polygon[j].longitude;

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

// ---------------------------------------------------------------------------
// Region fitting
// ---------------------------------------------------------------------------

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/**
 * Compute a react-native-maps Region that fits all given points with a small
 * padding factor.
 */
export function getRegionForCoordinates(
  points: Array<{ lat: number; lng: number }>,
): Region {
  if (points.length === 0) {
    return {
      latitude: 39.8283,
      longitude: -98.5795,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }

  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;

  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  const PADDING = 1.3;
  const latDelta = Math.max((maxLat - minLat) * PADDING, 0.002);
  const lngDelta = Math.max((maxLng - minLng) * PADDING, 0.002);

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}
