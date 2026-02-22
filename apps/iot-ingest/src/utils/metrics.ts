// ---------------------------------------------------------------------------
// @rv-trax/iot-ingest — Simple in-memory metrics tracker
// ---------------------------------------------------------------------------

import type { Redis } from 'ioredis';
import type { ProcessingMetrics } from '../types.js';

// ── Internal counters ───────────────────────────────────────────────────────

const counters: Record<string, number> = {
  events_received: 0,
  events_valid: 0,
  events_rejected: 0,
  events_processed: 0,
};

const startTime = Date.now();

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Increment a named counter by 1.
 */
export function incrementCounter(
  name: 'events_received' | 'events_valid' | 'events_rejected' | 'events_processed',
): void {
  counters[name] = (counters[name] ?? 0) + 1;
}

/**
 * Retrieve the current counter value.
 */
export function getCounter(
  name: 'events_received' | 'events_valid' | 'events_rejected' | 'events_processed',
): number {
  return counters[name] ?? 0;
}

/**
 * Build a full ProcessingMetrics snapshot.
 * Reads queue depth from Redis via XLEN on the events stream.
 */
export async function getMetrics(redis: Redis, streamKey: string): Promise<ProcessingMetrics> {
  let queueDepth = 0;
  try {
    queueDepth = await redis.xlen(streamKey);
  } catch {
    // Redis unavailable — report 0
  }

  return {
    events_received: counters['events_received'] ?? 0,
    events_valid: counters['events_valid'] ?? 0,
    events_rejected: counters['events_rejected'] ?? 0,
    events_processed: counters['events_processed'] ?? 0,
    queue_depth: queueDepth,
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
  };
}

/**
 * Reset all counters to zero. Useful for testing.
 */
export function resetMetrics(): void {
  for (const key of Object.keys(counters)) {
    counters[key] = 0;
  }
}
