import { getStatusColor, calculateDistance, isPointInPolygon, getRegionForCoordinates } from '../geo';

// ---------------------------------------------------------------------------
// getStatusColor
// ---------------------------------------------------------------------------

describe('getStatusColor', () => {
  it('returns blue for new_arrival', () => {
    expect(getStatusColor('new_arrival' as any)).toBe('#3B82F6');
  });

  it('returns green for available', () => {
    expect(getStatusColor('available' as any)).toBe('#22C55E');
  });

  it('returns red for sold', () => {
    expect(getStatusColor('sold' as any)).toBe('#EF4444');
  });

  it('returns gray fallback for unknown status', () => {
    expect(getStatusColor('unknown_status' as any)).toBe('#6B7280');
  });
});

// ---------------------------------------------------------------------------
// calculateDistance (Haversine)
// ---------------------------------------------------------------------------

describe('calculateDistance', () => {
  it('returns 0 for the same point', () => {
    expect(calculateDistance(40.0, -90.0, 40.0, -90.0)).toBe(0);
  });

  it('calculates distance between two known cities', () => {
    // New York (40.7128, -74.0060) to Los Angeles (34.0522, -118.2437)
    // Approx 3,944 km
    const dist = calculateDistance(40.7128, -74.006, 34.0522, -118.2437);
    expect(dist).toBeGreaterThan(3_900_000);
    expect(dist).toBeLessThan(4_000_000);
  });

  it('handles short distances accurately', () => {
    // Two points ~111 km apart (1 degree latitude at equator)
    const dist = calculateDistance(0, 0, 1, 0);
    expect(dist).toBeGreaterThan(110_000);
    expect(dist).toBeLessThan(112_000);
  });
});

// ---------------------------------------------------------------------------
// isPointInPolygon
// ---------------------------------------------------------------------------

describe('isPointInPolygon', () => {
  const square = [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 10 },
    { latitude: 10, longitude: 10 },
    { latitude: 10, longitude: 0 },
  ];

  it('returns true for a point inside the polygon', () => {
    expect(isPointInPolygon({ latitude: 5, longitude: 5 }, square)).toBe(true);
  });

  it('returns false for a point outside the polygon', () => {
    expect(isPointInPolygon({ latitude: 15, longitude: 5 }, square)).toBe(false);
  });

  it('returns false for a clearly outside point', () => {
    expect(isPointInPolygon({ latitude: -5, longitude: -5 }, square)).toBe(false);
  });

  it('handles a triangular polygon', () => {
    const triangle = [
      { latitude: 0, longitude: 0 },
      { latitude: 10, longitude: 5 },
      { latitude: 0, longitude: 10 },
    ];
    expect(isPointInPolygon({ latitude: 3, longitude: 5 }, triangle)).toBe(true);
    expect(isPointInPolygon({ latitude: 9, longitude: 1 }, triangle)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getRegionForCoordinates
// ---------------------------------------------------------------------------

describe('getRegionForCoordinates', () => {
  it('returns US center default for empty array', () => {
    const region = getRegionForCoordinates([]);
    expect(region.latitude).toBeCloseTo(39.8283, 2);
    expect(region.longitude).toBeCloseTo(-98.5795, 2);
    expect(region.latitudeDelta).toBe(0.05);
    expect(region.longitudeDelta).toBe(0.05);
  });

  it('centres on a single point', () => {
    const region = getRegionForCoordinates([{ lat: 40, lng: -90 }]);
    expect(region.latitude).toBe(40);
    expect(region.longitude).toBe(-90);
  });

  it('uses minimum delta of 0.002', () => {
    const region = getRegionForCoordinates([{ lat: 40, lng: -90 }]);
    expect(region.latitudeDelta).toBeGreaterThanOrEqual(0.002);
    expect(region.longitudeDelta).toBeGreaterThanOrEqual(0.002);
  });

  it('calculates region spanning multiple points', () => {
    const points = [
      { lat: 40, lng: -91 },
      { lat: 42, lng: -89 },
    ];
    const region = getRegionForCoordinates(points);
    // Centre should be midpoint
    expect(region.latitude).toBe(41);
    expect(region.longitude).toBe(-90);
    // Delta should be (max - min) * 1.3 padding
    expect(region.latitudeDelta).toBeCloseTo(2 * 1.3, 5);
    expect(region.longitudeDelta).toBeCloseTo(2 * 1.3, 5);
  });
});
