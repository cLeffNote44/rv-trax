// ---------------------------------------------------------------------------
// RV Trax API — Geo-fence geometry service
// ---------------------------------------------------------------------------

// ── Types ------------------------------------------------------------------

export interface LatLng {
  lat: number;
  lng: number;
}

export type Polygon = LatLng[];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ── Constants --------------------------------------------------------------

/** 500 acres in square meters. */
const MAX_AREA_SQ_METERS = 2_023_428;

// ── Point-in-Polygon (ray casting algorithm) --------------------------------

/**
 * Determines whether a point lies inside a polygon using the ray casting
 * algorithm. Casts a horizontal ray to the right from the point and counts
 * how many polygon edges it intersects. An odd count means inside.
 */
export function isPointInPolygon(point: LatLng, polygon: Polygon): boolean {
  const { lat: px, lng: py } = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i]!.lat;
    const yi = polygon[i]!.lng;
    const xj = polygon[j]!.lat;
    const yj = polygon[j]!.lng;

    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

// ── Polygon containment check ----------------------------------------------

/**
 * Returns true if every vertex of `inner` lies inside `outer`.
 */
export function isPolygonInsidePolygon(
  inner: Polygon,
  outer: Polygon,
): boolean {
  return inner.every((point) => isPointInPolygon(point, outer));
}

// ── Polygon area (Shoelace formula) ----------------------------------------

/**
 * Approximate conversion factor: at a given latitude, 1 degree of latitude
 * is ~111,320 m. 1 degree of longitude is ~111,320 * cos(lat) m.
 * We compute the area in a local Cartesian approximation (metres), which is
 * accurate enough for dealership-lot-sized polygons.
 */
export function calculatePolygonArea(polygon: Polygon): number {
  if (polygon.length < 3) return 0;

  // Use the centroid latitude for the longitude scaling factor
  const centroid = calculatePolygonCentroid(polygon);
  const latRad = (centroid.lat * Math.PI) / 180;
  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = 111_320 * Math.cos(latRad);

  // Convert all points to local metres
  const pts = polygon.map((p) => ({
    x: (p.lng - centroid.lng) * metersPerDegreeLng,
    y: (p.lat - centroid.lat) * metersPerDegreeLat,
  }));

  // Shoelace formula
  let area = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j]!.x + pts[i]!.x) * (pts[j]!.y - pts[i]!.y);
  }

  return Math.abs(area / 2);
}

// ── Polygon centroid -------------------------------------------------------

/**
 * Calculate the centroid (geometric center) of a polygon using the standard
 * formula for the centroid of a simple polygon.
 */
export function calculatePolygonCentroid(polygon: Polygon): LatLng {
  if (polygon.length === 0) return { lat: 0, lng: 0 };

  let latSum = 0;
  let lngSum = 0;

  for (const point of polygon) {
    latSum += point.lat;
    lngSum += point.lng;
  }

  return {
    lat: latSum / polygon.length,
    lng: lngSum / polygon.length,
  };
}

// ── Polygon validation -----------------------------------------------------

/**
 * Validate a polygon represented as coordinate pairs [[lat, lng], ...].
 * Checks:
 *   - At least 3 points
 *   - Auto-closes if first !== last (returns normalised coordinates)
 *   - No self-intersections (basic adjacent-edge check)
 *   - Reasonable area (<= 500 acres / ~2 million sq m)
 */
export function validatePolygon(
  coordinates: Array<[number, number]>,
): ValidationResult & { normalised?: Array<[number, number]> } {
  if (!Array.isArray(coordinates)) {
    return { valid: false, error: 'Boundary must be an array of coordinate pairs' };
  }

  if (coordinates.length < 3) {
    return { valid: false, error: 'Polygon must have at least 3 points' };
  }

  // Ensure coordinates are valid numbers
  for (let i = 0; i < coordinates.length; i++) {
    const pair = coordinates[i]!;
    if (
      !Array.isArray(pair) ||
      pair.length !== 2 ||
      typeof pair[0] !== 'number' ||
      typeof pair[1] !== 'number' ||
      !isFinite(pair[0]) ||
      !isFinite(pair[1])
    ) {
      return { valid: false, error: `Invalid coordinate at index ${i}` };
    }
    if (pair[0] < -90 || pair[0] > 90) {
      return { valid: false, error: `Latitude out of range at index ${i}` };
    }
    if (pair[1] < -180 || pair[1] > 180) {
      return { valid: false, error: `Longitude out of range at index ${i}` };
    }
  }

  // Auto-close polygon if needed
  const normalised = [...coordinates];
  const first = normalised[0]!;
  const last = normalised[normalised.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) {
    normalised.push([first[0], first[1]]);
  }

  // Basic self-intersection check (non-adjacent edges)
  if (hasSelfIntersections(normalised)) {
    return { valid: false, error: 'Polygon has self-intersections' };
  }

  // Area check
  const polygon: Polygon = normalised.map(([lat, lng]) => ({ lat, lng }));
  const area = calculatePolygonArea(polygon);

  if (area > MAX_AREA_SQ_METERS) {
    return {
      valid: false,
      error: `Polygon area (${Math.round(area)} sq m) exceeds maximum of ${MAX_AREA_SQ_METERS} sq m (~500 acres)`,
    };
  }

  return { valid: true, normalised };
}

// ── Self-intersection detection (basic) ------------------------------------

/**
 * Check whether a closed polygon has any self-intersections by testing
 * every pair of non-adjacent edges for intersection.
 */
function hasSelfIntersections(coords: Array<[number, number]>): boolean {
  const n = coords.length - 1; // number of edges (last point == first)
  if (n < 4) return false; // triangle cannot self-intersect

  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      // Skip the wrap-around pair (first edge and last edge share a vertex)
      if (i === 0 && j === n - 1) continue;

      if (
        segmentsIntersect(
          coords[i]!, coords[i + 1]!,
          coords[j]!, coords[j + 1]!,
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Returns true if line segments (p1->p2) and (p3->p4) properly intersect
 * (crossing, not merely touching at endpoints).
 */
function segmentsIntersect(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  p4: [number, number],
): boolean {
  const d1 = direction(p3, p4, p1);
  const d2 = direction(p3, p4, p2);
  const d3 = direction(p1, p2, p3);
  const d4 = direction(p1, p2, p4);

  if (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  ) {
    return true;
  }

  return false;
}

function direction(
  pi: [number, number],
  pj: [number, number],
  pk: [number, number],
): number {
  return (pk[0] - pi[0]) * (pj[1] - pi[1]) - (pj[0] - pi[0]) * (pk[1] - pi[1]);
}

// ── Helper: convert coordinate pairs to Polygon ---------------------------

export function coordsToPolygon(
  coords: Array<[number, number]>,
): Polygon {
  return coords.map(([lat, lng]) => ({ lat, lng }));
}
