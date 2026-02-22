import { describe, it, expect } from 'vitest';
import { isPointInPolygon } from '../geofence.js';

// ── Test polygon: a square around (36.16, -86.78) ──────────────────────────

const square: [number, number][] = [
  [36.159, -86.781], // SW
  [36.159, -86.779], // SE
  [36.161, -86.779], // NE
  [36.161, -86.781], // NW
];

describe('isPointInPolygon', () => {
  it('returns true for a point clearly inside', () => {
    expect(isPointInPolygon(36.16, -86.78, square)).toBe(true);
  });

  it('returns false for a point clearly outside', () => {
    expect(isPointInPolygon(36.17, -86.78, square)).toBe(false);
  });

  it('returns false for a point to the west', () => {
    expect(isPointInPolygon(36.16, -86.785, square)).toBe(false);
  });

  it('returns false for a point to the east', () => {
    expect(isPointInPolygon(36.16, -86.775, square)).toBe(false);
  });

  it('handles a triangle polygon', () => {
    const triangle: [number, number][] = [
      [0, 0],
      [0, 10],
      [10, 5],
    ];
    // Centroid ~(3.33, 5) should be inside
    expect(isPointInPolygon(3, 5, triangle)).toBe(true);
    // Far outside
    expect(isPointInPolygon(20, 20, triangle)).toBe(false);
  });

  it('handles a concave (L-shaped) polygon', () => {
    // L-shape: bottom-left notch
    const lShape: [number, number][] = [
      [0, 0],
      [0, 10],
      [5, 10],
      [5, 5],
      [10, 5],
      [10, 0],
    ];
    // Inside the bottom-right arm
    expect(isPointInPolygon(2, 7, lShape)).toBe(true);
    // Inside the top-left arm
    expect(isPointInPolygon(7, 2, lShape)).toBe(true);
    // Inside the notch (should be outside)
    expect(isPointInPolygon(7, 7, lShape)).toBe(false);
  });

  it('returns false for a degenerate polygon (less than 3 points)', () => {
    const line: [number, number][] = [
      [0, 0],
      [10, 10],
    ];
    expect(isPointInPolygon(5, 5, line)).toBe(false);
  });

  it('returns false for an empty polygon', () => {
    expect(isPointInPolygon(0, 0, [])).toBe(false);
  });

  it('works with real-world coordinates (Nashville dealer lot)', () => {
    // Approximate lot boundary in Nashville
    const lotBoundary: [number, number][] = [
      [36.1620, -86.7825],
      [36.1620, -86.7810],
      [36.1635, -86.7810],
      [36.1635, -86.7825],
    ];

    // Center of lot
    expect(isPointInPolygon(36.1627, -86.7818, lotBoundary)).toBe(true);
    // Just outside to the north
    expect(isPointInPolygon(36.1640, -86.7818, lotBoundary)).toBe(false);
  });
});
