// ---------------------------------------------------------------------------
// @rv-trax/iot-ingest — Event validation, dedup, rate limiting, and enqueue
// ---------------------------------------------------------------------------

import type { Redis } from 'ioredis';
import { eq } from 'drizzle-orm';
import type { Database } from '@rv-trax/db';
import { trackers } from '@rv-trax/db';
import type { TrackerEvent, ValidationResult, AppConfig } from '../types.js';
import { incrementCounter } from '../utils/metrics.js';

// ── Constants ───────────────────────────────────────────────────────────────

/** Maximum allowed clock skew when validating timestamps (30 seconds). */
const MAX_CLOCK_SKEW_MS = 30_000;

// ── Validation helpers ──────────────────────────────────────────────────────

function isValidCoordinate(lat: number | null, lng: number | null): boolean {
  if (lat === null && lng === null) {
    // No GPS fix is acceptable
    return true;
  }
  if (lat === null || lng === null) {
    // One null and one not — invalid
    return false;
  }
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function isTimestampReasonable(timestamp: string): boolean {
  const ts = new Date(timestamp).getTime();
  if (isNaN(ts)) {
    return false;
  }
  const now = Date.now();
  // Must not be in the future beyond allowed skew
  return ts <= now + MAX_CLOCK_SKEW_MS;
}

function isValidBattery(mv: number): boolean {
  return mv >= 0 && mv <= 5000;
}

// ── Main validation + enqueue pipeline ──────────────────────────────────────

/**
 * Validate a TrackerEvent, deduplicate, rate-limit, and push to the Redis
 * stream if all checks pass.
 *
 * @returns A ValidationResult indicating acceptance or rejection with reason.
 */
export async function validateAndEnqueue(
  event: TrackerEvent,
  redis: Redis,
  db: Database,
  config: AppConfig,
): Promise<ValidationResult> {
  incrementCounter('events_received');

  // 1. Validate device_eui exists in the trackers table
  const [tracker] = await db
    .select({ id: trackers.id })
    .from(trackers)
    .where(eq(trackers.deviceEui, event.device_eui))
    .limit(1);

  if (!tracker) {
    incrementCounter('events_rejected');
    return { accepted: false, reason: `Unknown device: ${event.device_eui}` };
  }

  // 2. Validate coordinates
  if (!isValidCoordinate(event.latitude, event.longitude)) {
    incrementCounter('events_rejected');
    return {
      accepted: false,
      reason: `Invalid coordinates: lat=${String(event.latitude)}, lng=${String(event.longitude)}`,
    };
  }

  // 3. Validate timestamp is not in the future
  if (!isTimestampReasonable(event.timestamp)) {
    incrementCounter('events_rejected');
    return {
      accepted: false,
      reason: `Timestamp is in the future or invalid: ${event.timestamp}`,
    };
  }

  // 4. Validate battery voltage
  if (!isValidBattery(event.battery_mv)) {
    incrementCounter('events_rejected');
    return {
      accepted: false,
      reason: `Battery voltage out of range: ${String(event.battery_mv)} mV`,
    };
  }

  // 5. Deduplication — prevent processing the same uplink twice
  const dedupKey = `dedup:${event.device_eui}:${event.deduplication_id}`;
  const dedupSet = await redis.set(dedupKey, '1', 'EX', config.dedupTtlSeconds, 'NX');
  if (dedupSet === null) {
    incrementCounter('events_rejected');
    return { accepted: false, reason: 'Duplicate event' };
  }

  // 6. Rate limiting — max 1 event per device per RATE_LIMIT_SECONDS
  const rateKey = `rate:${event.device_eui}`;
  const rateSet = await redis.set(rateKey, '1', 'EX', config.rateLimitSeconds, 'NX');
  if (rateSet === null) {
    incrementCounter('events_rejected');
    return { accepted: false, reason: 'Rate limited' };
  }

  // 7. All checks passed — push to Redis Stream
  try {
    const fields: string[] = [
      'device_eui', event.device_eui,
      'timestamp', event.timestamp,
      'latitude', String(event.latitude ?? ''),
      'longitude', String(event.longitude ?? ''),
      'altitude', String(event.altitude ?? ''),
      'accuracy_meters', String(event.accuracy_meters ?? ''),
      'rssi', String(event.rssi),
      'snr', String(event.snr),
      'battery_mv', String(event.battery_mv),
      'battery_pct', String(event.battery_pct),
      'motion_detected', event.motion_detected ? '1' : '0',
      'gateway_id', event.gateway_id,
      'gateway_rssi', String(event.gateway_rssi),
      'raw_payload', event.raw_payload ?? '',
      'deduplication_id', event.deduplication_id,
    ];

    // XADD with MAXLEN to cap stream size and prevent unbounded memory use
    await redis.xadd(
      config.redis.streamKey,
      'MAXLEN',
      '~',
      String(config.redis.streamMaxLen),
      '*',
      ...fields,
    );

    incrementCounter('events_valid');
    incrementCounter('events_processed');

    return { accepted: true };
  } catch (err) {
    incrementCounter('events_rejected');
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { accepted: false, reason: `Failed to enqueue: ${message}` };
  }
}
