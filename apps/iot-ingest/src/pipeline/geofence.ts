// ---------------------------------------------------------------------------
// @rv-trax/iot-ingest — Pipeline Step 7: Geo-fence checking
// ---------------------------------------------------------------------------

import { eq, and } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import {
  geoFences,
  geoFenceEvents,
  alertRules,
  alerts,
  type Database,
} from '@rv-trax/db';
import type { GeoFenceCheck } from './types.js';

// ── Cache ─────────────────────────────────────────────────────────────────

interface FencePolygon {
  id: string;
  name: string;
  fenceType: string;
  boundary: [number, number][];
}

interface FenceCache {
  fences: FencePolygon[];
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const fenceCacheMap = new Map<string, FenceCache>();

/**
 * Clear geo-fence cache (useful for testing).
 */
export function clearGeoFenceCache(): void {
  fenceCacheMap.clear();
}

// ── Fence loading ─────────────────────────────────────────────────────────

async function loadFences(
  lotId: string,
  db: Database,
): Promise<FencePolygon[]> {
  const cached = fenceCacheMap.get(lotId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.fences;
  }

  const rows = await db
    .select({
      id: geoFences.id,
      name: geoFences.name,
      fenceType: geoFences.fenceType,
      boundary: geoFences.boundary,
    })
    .from(geoFences)
    .where(and(eq(geoFences.lotId, lotId), eq(geoFences.isActive, true)));

  const fences: FencePolygon[] = rows
    .filter((r) => r.boundary !== null)
    .map((r) => ({
      id: r.id,
      name: r.name,
      fenceType: r.fenceType,
      boundary: parseBoundary(r.boundary!),
    }))
    .filter((f) => f.boundary.length >= 3);

  fenceCacheMap.set(lotId, { fences, expiresAt: Date.now() + CACHE_TTL_MS });
  return fences;
}

// ── Main geo-fence check ──────────────────────────────────────────────────

/**
 * Check all active geo-fences for a lot, comparing current containment state
 * against previous state to detect enter/exit transitions.
 *
 * For each state change:
 * 1. Insert a geo_fence_events record
 * 2. Check alert_rules for matching geofence_enter / geofence_exit rules
 * 3. If a rule matches: create an alert and publish via Redis pub/sub
 * 4. Update Redis hash with new fence containment states
 */
export async function checkGeoFences(
  unitId: string,
  lat: number,
  lng: number,
  lotId: string,
  dealershipId: string,
  db: Database,
  redis: Redis,
): Promise<GeoFenceCheck[]> {
  const fences = await loadFences(lotId, db);
  if (fences.length === 0) return [];

  // Get previous fence states from Redis
  let previousStates: Record<string, boolean> = {};
  try {
    const raw = await redis.hget(`unit:${unitId}:fences`, 'states');
    if (raw) {
      previousStates = JSON.parse(raw);
    }
  } catch {
    // Redis unavailable — treat as no previous states
  }

  // Test current containment for each fence
  const currentStates: Record<string, boolean> = {};
  const events: GeoFenceCheck[] = [];

  for (const fence of fences) {
    const inside = isPointInPolygon(lat, lng, fence.boundary);
    currentStates[fence.id] = inside;

    const wasInside = previousStates[fence.id] ?? false;

    if (!wasInside && inside) {
      // Enter event
      events.push({ fenceId: fence.id, fenceName: fence.name, eventType: 'enter' });
    } else if (wasInside && !inside) {
      // Exit event
      events.push({ fenceId: fence.id, fenceName: fence.name, eventType: 'exit' });
    }
  }

  // Process each state-change event
  for (const event of events) {
    // 1. Insert geo_fence_events record
    await db
      .insert(geoFenceEvents)
      .values({
        geoFenceId: event.fenceId,
        unitId,
        eventType: event.eventType,
        occurredAt: new Date(),
      })
      .catch((err) => {
        console.error('[geofence] Failed to insert geo_fence_event:', err);
      });

    // 2. Check alert rules
    const ruleType =
      event.eventType === 'enter' ? 'geofence_enter' : 'geofence_exit';

    const matchingRules = await db
      .select({
        id: alertRules.id,
        severity: alertRules.severity,
      })
      .from(alertRules)
      .where(
        and(
          eq(alertRules.dealershipId, dealershipId),
          eq(alertRules.ruleType, ruleType),
          eq(alertRules.isActive, true),
        ),
      )
      .catch(() => [] as { id: string; severity: string }[]);

    // 3. Create alerts for matching rules
    for (const rule of matchingRules) {
      const title = `Unit ${event.eventType === 'enter' ? 'entered' : 'exited'} ${event.fenceName}`;
      const message = `Geo-fence ${event.eventType} detected at (${lat.toFixed(6)}, ${lng.toFixed(6)})`;

      await db
        .insert(alerts)
        .values({
          dealershipId,
          ruleId: rule.id,
          alertType: ruleType,
          severity: rule.severity,
          title,
          message,
          unitId,
          geoFenceId: event.fenceId,
          status: 'new',
        })
        .catch((err) => {
          console.error('[geofence] Failed to insert alert:', err);
        });

      // Publish alert to Redis pub/sub
      const alertPayload = JSON.stringify({
        type: ruleType,
        severity: rule.severity,
        title,
        message,
        unitId,
        fenceId: event.fenceId,
        fenceName: event.fenceName,
        lat,
        lng,
        timestamp: new Date().toISOString(),
      });

      await redis
        .publish(`alerts:${dealershipId}`, alertPayload)
        .catch((err) => {
          console.error('[geofence] Failed to publish alert:', err);
        });
    }
  }

  // 4. Update Redis with current fence states
  try {
    await redis.hset(
      `unit:${unitId}:fences`,
      'states',
      JSON.stringify(currentStates),
    );
  } catch {
    // Redis write failure — non-fatal
  }

  return events;
}

// ── Point-in-polygon (ray casting) ───────────────────────────────────────

/**
 * Ray casting algorithm: test if a point is inside a polygon.
 */
export function isPointInPolygon(
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

function parseBoundary(boundary: string): [number, number][] {
  try {
    const parsed = JSON.parse(boundary);

    if (Array.isArray(parsed) && parsed.length >= 3) {
      if (Array.isArray(parsed[0]) && parsed[0].length === 2) {
        return parsed as [number, number][];
      }
    }

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
