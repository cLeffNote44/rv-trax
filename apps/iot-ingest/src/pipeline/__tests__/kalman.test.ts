import { describe, it, expect } from 'vitest';
import {
  KalmanFilter2D,
  latLngToMeters,
  metersToLatLng,
} from '../kalman.js';

// ── Coordinate conversion round-trip ────────────────────────────────────────

describe('latLngToMeters / metersToLatLng', () => {
  it('round-trips back to the same coordinates at the reference point', () => {
    const refLat = 36.1627;
    const refLng = -86.7816;
    const testLat = 36.1637;
    const testLng = -86.7806;

    const meters = latLngToMeters(testLat, testLng, refLat, refLng);
    const back = metersToLatLng(meters.x, meters.y, refLat, refLng);

    expect(back.latitude).toBeCloseTo(testLat, 5);
    expect(back.longitude).toBeCloseTo(testLng, 5);
  });

  it('returns (0, 0) when point equals reference', () => {
    const meters = latLngToMeters(40.0, -90.0, 40.0, -90.0);
    expect(meters.x).toBe(0);
    expect(meters.y).toBe(0);
  });

  it('produces positive y for northward offset', () => {
    const meters = latLngToMeters(40.001, -90.0, 40.0, -90.0);
    expect(meters.y).toBeGreaterThan(0);
    expect(meters.x).toBeCloseTo(0, 1);
  });

  it('produces positive x for eastward offset', () => {
    const meters = latLngToMeters(40.0, -89.999, 40.0, -90.0);
    expect(meters.x).toBeGreaterThan(0);
    expect(meters.y).toBeCloseTo(0, 1);
  });

  it('handles equator correctly', () => {
    const meters = latLngToMeters(0.001, 0.001, 0.0, 0.0);
    // At equator, 0.001 degree ≈ 111 meters
    expect(meters.x).toBeGreaterThan(100);
    expect(meters.y).toBeGreaterThan(100);
  });
});

// ── KalmanFilter2D ──────────────────────────────────────────────────────────

describe('KalmanFilter2D', () => {
  it('initializes with default high uncertainty', () => {
    const filter = new KalmanFilter2D();
    const state = filter.getState();

    expect(state.x).toEqual([0, 0, 0, 0]);
    expect(state.refLat).toBe(0);
    expect(state.refLng).toBe(0);
    expect(state.lastUpdateMs).toBe(0);
    // Initial covariance should have high diagonal values
    expect(state.P[0]).toBe(100);
    expect(state.P[5]).toBe(100);
  });

  it('initializes at a known position', () => {
    const filter = new KalmanFilter2D();
    filter.initialize(36.16, -86.78, 1000);

    const state = filter.getState();
    expect(state.refLat).toBe(36.16);
    expect(state.refLng).toBe(-86.78);
    expect(state.x).toEqual([0, 0, 0, 0]);
    expect(state.lastUpdateMs).toBe(1000);
    // After init, covariance should be moderate (10 * identity)
    expect(state.P[0]).toBe(10);
  });

  it('restores from a saved state', () => {
    const filter1 = new KalmanFilter2D();
    filter1.initialize(36.16, -86.78, 1000);
    filter1.predict(1.0);

    const saved = filter1.getState();
    const filter2 = new KalmanFilter2D(saved);

    expect(filter2.getState()).toEqual(saved);
  });

  it('predict does nothing for dt <= 0', () => {
    const filter = new KalmanFilter2D();
    filter.initialize(36.16, -86.78, 1000);
    const before = filter.getState();

    filter.predict(0);
    expect(filter.getState().x).toEqual(before.x);

    filter.predict(-1);
    expect(filter.getState().x).toEqual(before.x);
  });

  it('predict advances position by velocity * dt', () => {
    const filter = new KalmanFilter2D({
      x: [10, 20, 1, 2],
      P: new Array(16).fill(0).map((_, i) => (i % 5 === 0 ? 1 : 0)),
      refLat: 36.16,
      refLng: -86.78,
      lastUpdateMs: 1000,
    });

    filter.predict(5); // 5 seconds
    const state = filter.getState();

    // x' = x + vx*dt = 10 + 1*5 = 15
    expect(state.x[0]).toBeCloseTo(15, 5);
    // y' = y + vy*dt = 20 + 2*5 = 30
    expect(state.x[1]).toBeCloseTo(30, 5);
    // Velocity unchanged
    expect(state.x[2]).toBeCloseTo(1, 5);
    expect(state.x[3]).toBeCloseTo(2, 5);
  });

  it('converges toward measurement after multiple updates', () => {
    const filter = new KalmanFilter2D();
    const refLat = 36.16;
    const refLng = -86.78;
    filter.initialize(refLat, refLng, Date.now());

    // Feed 10 measurements at a known offset (100m north)
    const targetMeters = latLngToMeters(refLat + 0.0009, refLng, refLat, refLng);

    for (let i = 0; i < 10; i++) {
      filter.predict(1.0);
      filter.update(targetMeters, 3);
    }

    const pos = filter.getPosition();
    // Should converge close to the target
    expect(pos.latitude).toBeCloseTo(refLat + 0.0009, 3);
    expect(pos.longitude).toBeCloseTo(refLng, 3);
  });

  it('resists single noisy measurements', () => {
    const filter = new KalmanFilter2D();
    const refLat = 36.16;
    const refLng = -86.78;
    filter.initialize(refLat, refLng, Date.now());

    // Give 5 good measurements at origin
    for (let i = 0; i < 5; i++) {
      filter.predict(1.0);
      filter.update({ x: 0, y: 0 }, 3);
    }

    // Then one very noisy measurement 500m away
    filter.predict(1.0);
    filter.update({ x: 500, y: 500 }, 3);

    const pos = filter.getPosition();
    // Should NOT jump to 500m — should be much closer to origin
    const meters = latLngToMeters(pos.latitude, pos.longitude, refLat, refLng);
    expect(Math.abs(meters.x)).toBeLessThan(300);
    expect(Math.abs(meters.y)).toBeLessThan(300);
  });

  it('getPosition returns reference coordinates when at origin', () => {
    const filter = new KalmanFilter2D();
    filter.initialize(36.16, -86.78, 1000);

    const pos = filter.getPosition();
    expect(pos.latitude).toBeCloseTo(36.16, 6);
    expect(pos.longitude).toBeCloseTo(-86.78, 6);
  });

  it('tracks setLastUpdate and getLastUpdate', () => {
    const filter = new KalmanFilter2D();
    filter.setLastUpdate(12345);
    expect(filter.getLastUpdate()).toBe(12345);
  });
});
