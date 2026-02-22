// ---------------------------------------------------------------------------
// @rv-trax/iot-ingest — Pipeline orchestrator
// ---------------------------------------------------------------------------
//
// Runs all pipeline steps in sequence for a single TrackerEvent.
// Each step is wrapped in its own try/catch so a failure in one step
// (e.g., geo-fence check) doesn't prevent the others from completing.
// ---------------------------------------------------------------------------

import type { Redis } from 'ioredis';
import type { Database } from '@rv-trax/db';
import type { TrackerEvent } from '../types.js';
import type { PipelineResult } from './types.js';
import { lookupTracker } from './lookup.js';
import { checkBattery } from './battery.js';
import { calculatePosition } from './position.js';
import { applyKalmanFilter } from './kalman.js';
import { snapToZone } from './zone-snap.js';
import { detectMovement } from './movement.js';
import { checkGeoFences } from './geofence.js';
import {
  updateLiveLocation,
  storeLocationHistory,
  broadcastUpdate,
  logMovementEvent,
} from './store.js';

/**
 * Process a single tracker event through the full location pipeline.
 *
 * Pipeline steps:
 *  1. lookupTracker     — resolve device_eui to tracker/unit/dealership/lot
 *  2. checkBattery      — update telemetry, generate low-battery alerts
 *  3. calculatePosition — GPS, RSSI centroid, or last-known fallback
 *  4. applyKalmanFilter — smooth position with 2D Kalman filter
 *  5. snapToZone        — match to nearest lot spot within 15m
 *  6. detectMovement    — compare to last known position
 *  7. checkGeoFences    — detect enter/exit transitions
 *  8. updateLiveLocation— write to Redis hashes + units table
 *  9. storeHistory      — insert into location_history hypertable
 * 10. broadcastUpdate   — Redis pub/sub for live map
 * 11. logMovement       — insert into movement_events table
 */
export async function processPipelineEvent(
  event: TrackerEvent,
  db: Database,
  redis: Redis,
): Promise<PipelineResult> {
  const startMs = Date.now();
  const result: PipelineResult = {
    deviceEui: event.device_eui,
    trackerId: '',
    unitId: null,
    dealershipId: null,
    position: null,
    smoothedPosition: null,
    zoneSnap: null,
    movement: null,
    geoFenceEvents: [],
    alertsGenerated: [],
    completed: false,
    skipReason: null,
    processingMs: 0,
  };

  // ── Step 1: Lookup tracker/unit/dealership/lot ────────────────────────
  let lookup;
  try {
    lookup = await lookupTracker(event.device_eui, db);
  } catch (err) {
    console.error(`[pipeline] Lookup failed for ${event.device_eui}:`, err);
    result.skipReason = 'lookup_error';
    result.processingMs = Date.now() - startMs;
    return result;
  }

  if (!lookup) {
    result.skipReason = 'tracker_not_assigned';
    result.processingMs = Date.now() - startMs;
    return result;
  }

  result.trackerId = lookup.tracker.id;
  result.unitId = lookup.unit.id;
  result.dealershipId = lookup.dealership.id;

  // ── Step 2: Check battery ─────────────────────────────────────────────
  try {
    const alertId = await checkBattery(
      lookup,
      event.battery_mv,
      event.battery_pct,
      event.rssi,
      db,
      redis,
    );
    if (alertId) {
      result.alertsGenerated.push(alertId);
    }
  } catch (err) {
    console.error(`[pipeline] Battery check failed for ${event.device_eui}:`, err);
    // Non-fatal — continue pipeline
  }

  // ── Step 3: Calculate position ────────────────────────────────────────
  try {
    result.position = await calculatePosition(event, lookup, redis);
  } catch (err) {
    console.error(`[pipeline] Position calc failed for ${event.device_eui}:`, err);
  }

  if (!result.position) {
    // No position available — still mark as completed (telemetry was updated)
    result.completed = true;
    result.skipReason = 'no_position';
    result.processingMs = Date.now() - startMs;
    return result;
  }

  const { latitude, longitude, source } = result.position;

  // ── Step 4: Apply Kalman filter ───────────────────────────────────────
  let smoothedLat = latitude;
  let smoothedLng = longitude;

  try {
    const kalmanResult = await applyKalmanFilter(
      event.device_eui,
      latitude,
      longitude,
      source,
      redis,
    );
    smoothedLat = kalmanResult.smoothedLat;
    smoothedLng = kalmanResult.smoothedLng;
    result.smoothedPosition = {
      latitude: smoothedLat,
      longitude: smoothedLng,
    };
  } catch (err) {
    console.error(`[pipeline] Kalman filter failed for ${event.device_eui}:`, err);
    // Use raw position as fallback
    result.smoothedPosition = { latitude, longitude };
  }

  // ── Step 5: Snap to zone ──────────────────────────────────────────────
  if (lookup.lot) {
    try {
      result.zoneSnap = await snapToZone(
        smoothedLat,
        smoothedLng,
        lookup.lot.id,
        db,
      );
    } catch (err) {
      console.error(`[pipeline] Zone snap failed for ${event.device_eui}:`, err);
    }
  }

  const finalLat = result.zoneSnap?.snappedLat ?? smoothedLat;
  const finalLng = result.zoneSnap?.snappedLng ?? smoothedLng;
  const zone = result.zoneSnap?.zone ?? null;
  const row = result.zoneSnap?.row ?? null;
  const spot = result.zoneSnap?.spot ?? null;

  // ── Step 6: Detect movement ───────────────────────────────────────────
  try {
    result.movement = await detectMovement(
      lookup.unit.id,
      finalLat,
      finalLng,
      zone,
      row,
      spot,
      redis,
    );
  } catch (err) {
    console.error(`[pipeline] Movement detection failed for ${event.device_eui}:`, err);
  }

  const moved = result.movement?.moved ?? false;

  // ── Step 7: Check geo-fences ──────────────────────────────────────────
  if (lookup.lot) {
    try {
      result.geoFenceEvents = await checkGeoFences(
        lookup.unit.id,
        finalLat,
        finalLng,
        lookup.lot.id,
        lookup.dealership.id,
        db,
        redis,
      );
    } catch (err) {
      console.error(`[pipeline] Geo-fence check failed for ${event.device_eui}:`, err);
    }
  }

  // ── Step 8: Update live location ──────────────────────────────────────
  try {
    await updateLiveLocation(
      event.device_eui,
      lookup.tracker.id,
      lookup.unit.id,
      finalLat,
      finalLng,
      zone,
      row,
      spot,
      redis,
      db,
    );
  } catch (err) {
    console.error(`[pipeline] Live location update failed for ${event.device_eui}:`, err);
  }

  // ── Step 9: Store location history ────────────────────────────────────
  try {
    await storeLocationHistory(
      event,
      lookup.tracker.id,
      lookup.unit.id,
      lookup.dealership.id,
      result.position,
      result.zoneSnap,
      moved,
      redis,
      db,
    );
  } catch (err) {
    console.error(`[pipeline] History storage failed for ${event.device_eui}:`, err);
  }

  // ── Step 10: Broadcast update ─────────────────────────────────────────
  try {
    await broadcastUpdate(
      lookup.dealership.id,
      lookup.unit.id,
      finalLat,
      finalLng,
      zone,
      row,
      spot,
      moved,
      redis,
    );
  } catch (err) {
    console.error(`[pipeline] Broadcast failed for ${event.device_eui}:`, err);
  }

  // ── Step 11: Log movement ─────────────────────────────────────────────
  if (result.movement?.moved) {
    try {
      await logMovementEvent(
        result.movement,
        lookup.unit.id,
        lookup.dealership.id,
        db,
      );
    } catch (err) {
      console.error(`[pipeline] Movement log failed for ${event.device_eui}:`, err);
    }
  }

  result.completed = true;
  result.processingMs = Date.now() - startMs;
  return result;
}
