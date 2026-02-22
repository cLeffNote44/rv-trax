// ---------------------------------------------------------------------------
// @rv-trax/iot-ingest — Pipeline Step 4: Kalman filter for position smoothing
// ---------------------------------------------------------------------------
//
// 2D Kalman filter operating on a local tangent plane (meters).
// State vector: [x, y, vx, vy] — position + velocity in meters.
// Designed for slow-moving or stationary targets (RVs on a dealer lot).
//
// Process noise is tuned for vehicles that almost never move: very low
// velocity noise means the filter strongly resists jumps from noisy GPS.
// Measurement noise is set per-source: GPS ~3m, RSSI ~75m.
// ---------------------------------------------------------------------------

import type { Redis } from 'ioredis';
import type { LocationSource } from '@rv-trax/shared';
import type { KalmanState } from './types.js';

// ── Constants ─────────────────────────────────────────────────────────────

/** Earth radius in meters for coordinate conversions */
const EARTH_RADIUS_M = 6_371_000;

/** Reset the filter if the tracker hasn't reported in this many ms (10 min) */
const FILTER_RESET_THRESHOLD_MS = 10 * 60 * 1000;

/** Measurement noise standard deviations (meters) by source */
const MEASUREMENT_NOISE: Record<string, number> = {
  gps: 3,
  rssi: 75,
  manual: 150,
};

/** Process noise: how much we expect position to drift per second (m/s^2) */
const PROCESS_NOISE_POS = 0.01; // Very low — RVs are usually stationary
const PROCESS_NOISE_VEL = 0.005;

// ── Coordinate conversion helpers ─────────────────────────────────────────

/**
 * Convert lat/lng to local (x, y) meter coordinates relative to a reference point.
 * Uses equirectangular approximation — accurate enough for lot-scale distances.
 */
export function latLngToMeters(
  lat: number,
  lng: number,
  refLat: number,
  refLng: number,
): { x: number; y: number } {
  const dLat = ((lat - refLat) * Math.PI) / 180;
  const dLng = ((lng - refLng) * Math.PI) / 180;
  const cosRef = Math.cos((refLat * Math.PI) / 180);

  return {
    x: dLng * cosRef * EARTH_RADIUS_M,
    y: dLat * EARTH_RADIUS_M,
  };
}

/**
 * Convert local (x, y) meter coordinates back to lat/lng.
 */
export function metersToLatLng(
  x: number,
  y: number,
  refLat: number,
  refLng: number,
): { latitude: number; longitude: number } {
  const cosRef = Math.cos((refLat * Math.PI) / 180);
  const dLat = y / EARTH_RADIUS_M;
  const dLng = x / (cosRef * EARTH_RADIUS_M);

  return {
    latitude: refLat + (dLat * 180) / Math.PI,
    longitude: refLng + (dLng * 180) / Math.PI,
  };
}

// ── 4x4 matrix helpers (row-major flat array) ─────────────────────────────

function mat4Identity(): number[] {
  // prettier-ignore
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}

function mat4Multiply(A: number[], B: number[]): number[] {
  const C = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += A[i * 4 + k]! * B[k * 4 + j]!;
      }
      C[i * 4 + j] = sum;
    }
  }
  return C;
}

function mat4Add(A: number[], B: number[]): number[] {
  return A.map((v, i) => v + B[i]!);
}

function mat4Transpose(A: number[]): number[] {
  const T = new Array(16).fill(0);
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      T[i * 4 + j] = A[j * 4 + i]!;
    }
  }
  return T;
}

// ── Kalman Filter Class ───────────────────────────────────────────────────

export class KalmanFilter2D {
  /** State vector: [x, y, vx, vy] */
  private x: [number, number, number, number];
  /** 4x4 covariance matrix (row-major) */
  private P: number[];
  /** Reference lat/lng for coordinate transforms */
  private refLat: number;
  private refLng: number;
  /** Last update timestamp (epoch ms) */
  private lastUpdateMs: number;

  constructor(state?: KalmanState) {
    if (state) {
      this.x = [...state.x] as [number, number, number, number];
      this.P = [...state.P];
      this.refLat = state.refLat;
      this.refLng = state.refLng;
      this.lastUpdateMs = state.lastUpdateMs;
    } else {
      this.x = [0, 0, 0, 0];
      this.P = mat4Identity().map((v) => v * 100); // High initial uncertainty
      this.refLat = 0;
      this.refLng = 0;
      this.lastUpdateMs = 0;
    }
  }

  /**
   * Initialize the filter at a known measurement position.
   */
  initialize(lat: number, lng: number, nowMs: number): void {
    this.refLat = lat;
    this.refLng = lng;
    this.x = [0, 0, 0, 0]; // At reference point, zero velocity
    this.P = mat4Identity().map((v) => v * 10); // Moderate initial uncertainty
    this.lastUpdateMs = nowMs;
  }

  /**
   * Predict step: advance state by dt seconds using constant-velocity model.
   */
  predict(dtSeconds: number): void {
    if (dtSeconds <= 0) return;

    // State transition matrix F
    // [1, 0, dt, 0 ]
    // [0, 1, 0,  dt]
    // [0, 0, 1,  0 ]
    // [0, 0, 0,  1 ]
    const dt = dtSeconds;
    // prettier-ignore
    const F = [
      1, 0, dt, 0,
      0, 1, 0,  dt,
      0, 0, 1,  0,
      0, 0, 0,  1,
    ];

    // Predict state: x' = F * x
    const newX: [number, number, number, number] = [
      this.x[0] + this.x[2] * dt,
      this.x[1] + this.x[3] * dt,
      this.x[2],
      this.x[3],
    ];
    this.x = newX;

    // Predict covariance: P' = F * P * F^T + Q
    const Ft = mat4Transpose(F);
    const FP = mat4Multiply(F, this.P);
    const FPFt = mat4Multiply(FP, Ft);

    // Process noise Q — tuned for stationary targets
    const dt2 = dt * dt;
    const dt3 = dt2 * dt;
    const dt4 = dt3 * dt;
    const qp = PROCESS_NOISE_POS;
    const qv = PROCESS_NOISE_VEL;
    // prettier-ignore
    const Q = [
      dt4/4*qp, 0,         dt3/2*qp, 0,
      0,         dt4/4*qp, 0,         dt3/2*qp,
      dt3/2*qp, 0,         dt2*qv,   0,
      0,         dt3/2*qp, 0,         dt2*qv,
    ];

    this.P = mat4Add(FPFt, Q);
  }

  /**
   * Update step: incorporate a position measurement.
   * Measurement model: z = H * x + noise
   * H = [[1, 0, 0, 0], [0, 1, 0, 0]]  (we observe x and y only)
   */
  update(measurement: { x: number; y: number }, noiseStdDev: number): void {
    const R = noiseStdDev * noiseStdDev; // Measurement noise variance

    // Innovation: y = z - H*x
    const innovX = measurement.x - this.x[0];
    const innovY = measurement.y - this.x[1];

    // Innovation covariance: S = H * P * H^T + R
    // Since H selects first 2 rows/cols of P:
    const S00 = this.P[0 * 4 + 0]! + R;
    const S01 = this.P[0 * 4 + 1]!;
    const S10 = this.P[1 * 4 + 0]!;
    const S11 = this.P[1 * 4 + 1]! + R;

    // Invert 2x2 S matrix
    const det = S00! * S11! - S01! * S10!;
    if (Math.abs(det) < 1e-12) return; // Degenerate — skip update

    const invDet = 1 / det;
    const Si00 = S11! * invDet;
    const Si01 = -S01! * invDet;
    const Si10 = -S10! * invDet;
    const Si11 = S00! * invDet;

    // Kalman gain: K = P * H^T * S^-1 (4x2 matrix)
    // P * H^T selects first 2 columns of P
    const K = new Array(8).fill(0);
    for (let i = 0; i < 4; i++) {
      const ph0 = this.P[i * 4 + 0]!;
      const ph1 = this.P[i * 4 + 1]!;
      K[i * 2 + 0] = ph0 * Si00 + ph1 * Si10;
      K[i * 2 + 1] = ph0 * Si01 + ph1 * Si11;
    }

    // Update state: x' = x + K * innovation
    for (let i = 0; i < 4; i++) {
      (this.x as number[])[i] = this.x[i]! + K[i * 2 + 0]! * innovX + K[i * 2 + 1]! * innovY;
    }

    // Update covariance: P' = (I - K*H) * P
    // K*H is 4x4: K(4x2) * H(2x4) where H = [[1,0,0,0],[0,1,0,0]]
    const KH = new Array(16).fill(0);
    for (let i = 0; i < 4; i++) {
      KH[i * 4 + 0] = K[i * 2 + 0]!;
      KH[i * 4 + 1] = K[i * 2 + 1]!;
      // cols 2,3 stay zero
    }

    const I = mat4Identity();
    const ImKH = I.map((v, idx) => v - KH[idx]!);
    this.P = mat4Multiply(ImKH, this.P);
  }

  /**
   * Get the current estimated position in lat/lng.
   */
  getPosition(): { latitude: number; longitude: number } {
    return metersToLatLng(this.x[0], this.x[1], this.refLat, this.refLng);
  }

  /**
   * Export filter state for serialization.
   */
  getState(): KalmanState {
    return {
      x: [...this.x],
      P: [...this.P],
      refLat: this.refLat,
      refLng: this.refLng,
      lastUpdateMs: this.lastUpdateMs,
    };
  }

  /**
   * Set the last update timestamp.
   */
  setLastUpdate(ms: number): void {
    this.lastUpdateMs = ms;
  }

  /**
   * Get the last update timestamp.
   */
  getLastUpdate(): number {
    return this.lastUpdateMs;
  }
}

// ── Main pipeline function ────────────────────────────────────────────────

/**
 * Apply Kalman filtering to smooth a position measurement.
 *
 * Loads previous filter state from Redis. If no state exists (first event),
 * initializes at the measurement. If the tracker hasn't reported in over
 * 10 minutes, resets the filter (tracker may have been moved manually).
 *
 * Returns the smoothed lat/lng and the updated filter state for storage.
 */
export async function applyKalmanFilter(
  deviceEui: string,
  lat: number,
  lng: number,
  source: LocationSource,
  redis: Redis,
): Promise<{
  smoothedLat: number;
  smoothedLng: number;
  filterState: KalmanState;
}> {
  const nowMs = Date.now();

  // Load previous state from Redis
  let filter: KalmanFilter2D;
  let previousState: KalmanState | null = null;

  try {
    const stateJson = await redis.get(`kalman:${deviceEui}`);
    if (stateJson) {
      previousState = JSON.parse(stateJson) as KalmanState;
    }
  } catch {
    // Redis read failed — initialize fresh
  }

  if (!previousState) {
    // First event for this tracker — initialize at measurement
    filter = new KalmanFilter2D();
    filter.initialize(lat, lng, nowMs);
  } else {
    const timeSinceLast = nowMs - previousState.lastUpdateMs;

    if (timeSinceLast > FILTER_RESET_THRESHOLD_MS) {
      // Too long since last report — reset filter
      filter = new KalmanFilter2D();
      filter.initialize(lat, lng, nowMs);
    } else {
      // Normal update — restore state, predict, update
      filter = new KalmanFilter2D(previousState);
      const dtSeconds = timeSinceLast / 1000;
      filter.predict(dtSeconds);
    }
  }

  // Convert measurement to local meters
  const state = filter.getState();
  const meas = latLngToMeters(lat, lng, state.refLat, state.refLng);

  // Get measurement noise for this source type
  const noise = MEASUREMENT_NOISE[source] ?? MEASUREMENT_NOISE['gps'] ?? 3;

  // Update filter with measurement
  filter.update(meas, noise);
  filter.setLastUpdate(nowMs);

  // Get smoothed position
  const smoothed = filter.getPosition();
  const newState = filter.getState();

  // Save state to Redis
  try {
    await redis.set(`kalman:${deviceEui}`, JSON.stringify(newState), 'EX', 3600);
  } catch {
    // Redis write failed — non-fatal
  }

  return {
    smoothedLat: smoothed.latitude,
    smoothedLng: smoothed.longitude,
    filterState: newState,
  };
}
