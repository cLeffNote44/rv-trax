import { describe, it, expect } from 'vitest';
import { computeWalkingRoute, type RoutePoint } from '../../services/route-optimizer.js';

describe('computeWalkingRoute', () => {
  it('returns empty result for empty input', () => {
    const result = computeWalkingRoute([]);
    expect(result.ordered_points).toHaveLength(0);
    expect(result.total_distance_m).toBe(0);
  });

  it('returns single point for single input', () => {
    const points: RoutePoint[] = [
      { id: '1', unitId: 'u1', stockNumber: 'S001', lat: 27.96, lng: -82.51 },
    ];
    const result = computeWalkingRoute(points);
    expect(result.ordered_points).toHaveLength(1);
    expect(result.ordered_points[0]!.sequence).toBe(1);
    expect(result.ordered_points[0]!.distance_from_prev_m).toBe(0);
    expect(result.total_distance_m).toBe(0);
  });

  it('visits all points exactly once', () => {
    const points: RoutePoint[] = [
      { id: '1', unitId: 'u1', stockNumber: 'S001', lat: 27.960, lng: -82.510 },
      { id: '2', unitId: 'u2', stockNumber: 'S002', lat: 27.961, lng: -82.510 },
      { id: '3', unitId: 'u3', stockNumber: 'S003', lat: 27.960, lng: -82.509 },
      { id: '4', unitId: 'u4', stockNumber: 'S004', lat: 27.962, lng: -82.508 },
    ];
    const result = computeWalkingRoute(points);
    expect(result.ordered_points).toHaveLength(4);

    const ids = result.ordered_points.map(p => p.id);
    expect(new Set(ids).size).toBe(4);

    // Sequences should be 1,2,3,4
    expect(result.ordered_points.map(p => p.sequence)).toEqual([1, 2, 3, 4]);

    // First point should be the original first point
    expect(result.ordered_points[0]!.id).toBe('1');
    expect(result.ordered_points[0]!.distance_from_prev_m).toBe(0);

    // Total distance should be positive
    expect(result.total_distance_m).toBeGreaterThan(0);
  });

  it('finds nearest-neighbor path (not worst-case)', () => {
    // Place 3 points in a line: A(0,0), B(0,1), C(0,2)
    // Nearest neighbor from A should go A->B->C, not A->C->B
    const points: RoutePoint[] = [
      { id: 'A', unitId: 'uA', stockNumber: 'SA', lat: 0, lng: 0 },
      { id: 'B', unitId: 'uB', stockNumber: 'SB', lat: 0, lng: 1 },
      { id: 'C', unitId: 'uC', stockNumber: 'SC', lat: 0, lng: 2 },
    ];
    const result = computeWalkingRoute(points);
    expect(result.ordered_points[1]!.id).toBe('B');
    expect(result.ordered_points[2]!.id).toBe('C');
  });

  it('calculates haversine distances correctly', () => {
    // Two points roughly 111km apart (1 degree latitude)
    const points: RoutePoint[] = [
      { id: '1', unitId: 'u1', stockNumber: 'S1', lat: 0, lng: 0 },
      { id: '2', unitId: 'u2', stockNumber: 'S2', lat: 1, lng: 0 },
    ];
    const result = computeWalkingRoute(points);
    const dist = result.total_distance_m;
    // 1 degree latitude ~ 111,195 meters
    expect(dist).toBeGreaterThan(110_000);
    expect(dist).toBeLessThan(112_000);
  });
});
