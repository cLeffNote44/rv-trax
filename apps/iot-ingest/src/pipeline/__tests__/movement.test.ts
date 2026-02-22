import { describe, it, expect } from 'vitest';
import { haversineDistance } from '../zone-snap.js';

describe('haversineDistance', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineDistance(36.16, -86.78, 36.16, -86.78)).toBe(0);
  });

  it('calculates roughly correct distance for known points', () => {
    // Nashville to about 1km north
    // 0.009 degrees lat ≈ ~1000m
    const dist = haversineDistance(36.16, -86.78, 36.169, -86.78);
    expect(dist).toBeGreaterThan(900);
    expect(dist).toBeLessThan(1100);
  });

  it('is symmetric', () => {
    const d1 = haversineDistance(36.16, -86.78, 36.17, -86.77);
    const d2 = haversineDistance(36.17, -86.77, 36.16, -86.78);
    expect(d1).toBeCloseTo(d2, 6);
  });

  it('handles cross-hemisphere distances', () => {
    // Equator to a point ~111km north
    const dist = haversineDistance(0, 0, 1, 0);
    expect(dist).toBeGreaterThan(110_000);
    expect(dist).toBeLessThan(112_000);
  });

  it('handles very small distances (lot scale)', () => {
    // ~10 meters apart
    const dist = haversineDistance(36.16, -86.78, 36.16009, -86.78);
    expect(dist).toBeGreaterThan(8);
    expect(dist).toBeLessThan(12);
  });

  it('handles antimeridian correctly', () => {
    // Points near 180/-180 boundary
    const dist = haversineDistance(0, 179.999, 0, -179.999);
    // Should be a very small distance (~222m), not half the globe
    expect(dist).toBeLessThan(500);
  });

  it('returns correct distance at the equator east-west', () => {
    // At equator, 1 degree longitude ≈ 111.32 km
    const dist = haversineDistance(0, 0, 0, 1);
    expect(dist).toBeGreaterThan(110_000);
    expect(dist).toBeLessThan(112_000);
  });
});

// Movement detection logic is in detectMovement() which requires Redis.
// The core math (haversine + threshold comparison) is tested above.
// Integration tests for detectMovement would need Redis mocking.

describe('movement threshold logic', () => {
  const MOVEMENT_THRESHOLD_M = 5;

  it('distance below threshold is not movement', () => {
    // 2 meters apart
    const dist = haversineDistance(36.16, -86.78, 36.160018, -86.78);
    expect(dist).toBeLessThan(MOVEMENT_THRESHOLD_M);
  });

  it('distance above threshold could be movement', () => {
    // ~10 meters apart
    const dist = haversineDistance(36.16, -86.78, 36.16009, -86.78);
    expect(dist).toBeGreaterThan(MOVEMENT_THRESHOLD_M);
  });
});
