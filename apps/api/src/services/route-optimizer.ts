// ---------------------------------------------------------------------------
// RV Trax API — Route optimizer service (nearest-neighbor TSP heuristic)
// ---------------------------------------------------------------------------

export interface RoutePoint {
  id: string;
  unitId: string;
  stockNumber: string;
  lat: number;
  lng: number;
}

export interface OrderedRoutePoint extends RoutePoint {
  sequence: number;
  distance_from_prev_m: number;
}

export interface RouteResult {
  ordered_points: OrderedRoutePoint[];
  total_distance_m: number;
}

/**
 * Haversine distance between two lat/lng points in meters.
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Compute an optimized walking route using nearest-neighbor TSP heuristic.
 * Starts from the first point and always goes to the nearest unvisited point.
 */
export function computeWalkingRoute(points: RoutePoint[]): RouteResult {
  if (points.length === 0) {
    return { ordered_points: [], total_distance_m: 0 };
  }

  const firstPoint = points[0];
  if (!firstPoint) {
    return { ordered_points: [], total_distance_m: 0 };
  }

  if (points.length === 1) {
    return {
      ordered_points: [
        { ...firstPoint, sequence: 1, distance_from_prev_m: 0 },
      ],
      total_distance_m: 0,
    };
  }

  const visited = new Set<number>();
  const ordered: OrderedRoutePoint[] = [];
  let totalDistance = 0;

  // Start with first point
  visited.add(0);
  ordered.push({ ...firstPoint, sequence: 1, distance_from_prev_m: 0 });
  let currentIdx = 0;

  while (visited.size < points.length) {
    let nearestIdx = -1;
    let nearestDist = Infinity;

    const current = points[currentIdx]!;

    for (let i = 0; i < points.length; i++) {
      if (visited.has(i)) continue;

      const candidate = points[i];
      if (!candidate) continue;

      const dist = haversineDistance(
        current.lat,
        current.lng,
        candidate.lat,
        candidate.lng,
      );

      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    if (nearestIdx === -1) break;

    const nearestPoint = points[nearestIdx];
    if (!nearestPoint) break;

    visited.add(nearestIdx);
    totalDistance += nearestDist;

    ordered.push({
      ...nearestPoint,
      sequence: ordered.length + 1,
      distance_from_prev_m: Math.round(nearestDist * 100) / 100,
    });

    currentIdx = nearestIdx;
  }

  return {
    ordered_points: ordered,
    total_distance_m: Math.round(totalDistance * 100) / 100,
  };
}
