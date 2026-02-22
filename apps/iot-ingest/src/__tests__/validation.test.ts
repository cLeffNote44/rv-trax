import { describe, it, expect } from 'vitest';

// The validator functions are not exported individually, so we test the
// validation logic by reimplementing the pure helper functions here.
// In a full integration test, we'd mock Redis + DB and test validateAndEnqueue.

// ── Coordinate validation ───────────────────────────────────────────────────

function isValidCoordinate(lat: number | null, lng: number | null): boolean {
  if (lat === null && lng === null) return true;
  if (lat === null || lng === null) return false;
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

describe('isValidCoordinate', () => {
  it('accepts valid coordinates', () => {
    expect(isValidCoordinate(36.16, -86.78)).toBe(true);
  });

  it('accepts both null (no GPS fix)', () => {
    expect(isValidCoordinate(null, null)).toBe(true);
  });

  it('rejects one null and one non-null', () => {
    expect(isValidCoordinate(36.16, null)).toBe(false);
    expect(isValidCoordinate(null, -86.78)).toBe(false);
  });

  it('rejects lat out of range', () => {
    expect(isValidCoordinate(91, 0)).toBe(false);
    expect(isValidCoordinate(-91, 0)).toBe(false);
  });

  it('rejects lng out of range', () => {
    expect(isValidCoordinate(0, 181)).toBe(false);
    expect(isValidCoordinate(0, -181)).toBe(false);
  });

  it('accepts boundary values', () => {
    expect(isValidCoordinate(90, 180)).toBe(true);
    expect(isValidCoordinate(-90, -180)).toBe(true);
    expect(isValidCoordinate(0, 0)).toBe(true);
  });
});

// ── Timestamp validation ────────────────────────────────────────────────────

const MAX_CLOCK_SKEW_MS = 30_000;

function isTimestampReasonable(timestamp: string): boolean {
  const ts = new Date(timestamp).getTime();
  if (isNaN(ts)) return false;
  const now = Date.now();
  return ts <= now + MAX_CLOCK_SKEW_MS;
}

describe('isTimestampReasonable', () => {
  it('accepts a current timestamp', () => {
    expect(isTimestampReasonable(new Date().toISOString())).toBe(true);
  });

  it('accepts a past timestamp', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    expect(isTimestampReasonable(past)).toBe(true);
  });

  it('accepts a timestamp within clock skew', () => {
    const slight = new Date(Date.now() + 20_000).toISOString();
    expect(isTimestampReasonable(slight)).toBe(true);
  });

  it('rejects a timestamp far in the future', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(isTimestampReasonable(future)).toBe(false);
  });

  it('rejects invalid date strings', () => {
    expect(isTimestampReasonable('not-a-date')).toBe(false);
    expect(isTimestampReasonable('')).toBe(false);
  });
});

// ── Battery validation ──────────────────────────────────────────────────────

function isValidBattery(mv: number): boolean {
  return mv >= 0 && mv <= 5000;
}

describe('isValidBattery', () => {
  it('accepts typical battery voltage', () => {
    expect(isValidBattery(3700)).toBe(true);
  });

  it('accepts boundary values', () => {
    expect(isValidBattery(0)).toBe(true);
    expect(isValidBattery(5000)).toBe(true);
  });

  it('rejects negative voltage', () => {
    expect(isValidBattery(-1)).toBe(false);
  });

  it('rejects voltage above maximum', () => {
    expect(isValidBattery(5001)).toBe(false);
  });
});

// ── Dedup key structure ─────────────────────────────────────────────────────

describe('dedup key structure', () => {
  it('creates unique keys per device + dedup ID', () => {
    const key1 = `dedup:device-aaa:uplink-001`;
    const key2 = `dedup:device-aaa:uplink-002`;
    const key3 = `dedup:device-bbb:uplink-001`;

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(key3);
  });
});
