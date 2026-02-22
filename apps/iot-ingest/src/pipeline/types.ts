// ---------------------------------------------------------------------------
// @rv-trax/iot-ingest — Pipeline type definitions
// ---------------------------------------------------------------------------

import type { LocationSource } from '@rv-trax/shared';

// ── Tracker Lookup Result ─────────────────────────────────────────────────

export interface TrackerLookup {
  tracker: {
    id: string;
    deviceEui: string;
    dealershipId: string;
    batteryPct: number | null;
    batteryMv: number | null;
    signalRssi: number | null;
    lastSeenAt: Date | null;
    status: string;
  };
  unit: {
    id: string;
    dealershipId: string;
    lotId: string | null;
    stockNumber: string;
    currentZone: string | null;
    currentRow: string | null;
    currentSpot: number | null;
  };
  dealership: {
    id: string;
    name: string;
    settings: Record<string, unknown> | null;
  };
  lot: {
    id: string;
    name: string;
    boundary: string | null;
  } | null;
  assignmentId: string;
}

// ── Position Result ───────────────────────────────────────────────────────

export interface PositionResult {
  latitude: number;
  longitude: number;
  accuracy: number;
  source: LocationSource;
}

// ── Kalman Filter State ───────────────────────────────────────────────────

export interface KalmanState {
  /** State vector [x, y, vx, vy] in meters (local tangent plane) */
  x: [number, number, number, number];
  /** 4x4 covariance matrix flattened to 16 elements (row-major) */
  P: number[];
  /** Reference latitude for coordinate transforms */
  refLat: number;
  /** Reference longitude for coordinate transforms */
  refLng: number;
  /** Timestamp of last update (epoch ms) */
  lastUpdateMs: number;
}

// ── Movement Result ───────────────────────────────────────────────────────

export interface MovementResult {
  moved: boolean;
  distance: number;
  fromZone: string | null;
  fromRow: string | null;
  fromSpot: number | null;
  fromLat: number | null;
  fromLng: number | null;
  toZone: string | null;
  toRow: string | null;
  toSpot: number | null;
}

// ── Zone Snap Result ──────────────────────────────────────────────────────

export interface ZoneSnapResult {
  zone: string | null;
  row: string | null;
  spot: number | null;
  snappedLat: number;
  snappedLng: number;
}

// ── Geo-Fence Check Result ────────────────────────────────────────────────

export interface GeoFenceCheck {
  fenceId: string;
  fenceName: string;
  eventType: 'enter' | 'exit';
}

// ── Pipeline Result ───────────────────────────────────────────────────────

export interface PipelineResult {
  /** Device EUI that triggered this pipeline run */
  deviceEui: string;
  /** Tracker ID (UUID) */
  trackerId: string;
  /** Unit ID (UUID), null if tracker is unassigned */
  unitId: string | null;
  /** Dealership ID (UUID), null if tracker is unknown */
  dealershipId: string | null;
  /** Computed position */
  position: PositionResult | null;
  /** Kalman-smoothed position */
  smoothedPosition: { latitude: number; longitude: number } | null;
  /** Zone snap result */
  zoneSnap: ZoneSnapResult | null;
  /** Movement detection result */
  movement: MovementResult | null;
  /** Geo-fence enter/exit events generated */
  geoFenceEvents: GeoFenceCheck[];
  /** Alerts generated during this pipeline run */
  alertsGenerated: string[];
  /** Whether pipeline completed all steps */
  completed: boolean;
  /** Reason if pipeline was short-circuited */
  skipReason: string | null;
  /** Processing duration in milliseconds */
  processingMs: number;
}

// ── Worker Metrics ────────────────────────────────────────────────────────

export interface WorkerMetrics {
  eventsProcessed: number;
  eventsErrored: number;
  eventsSkipped: number;
  avgProcessingMs: number;
  lastEventAt: number | null;
  startedAt: number;
}
