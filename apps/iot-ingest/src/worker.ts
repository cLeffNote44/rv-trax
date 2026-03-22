// ---------------------------------------------------------------------------
// @rv-trax/iot-ingest — Worker entry point
// ---------------------------------------------------------------------------
//
// Consumes tracker events from Redis Stream `iot:events`, processes each
// through the location pipeline, and acknowledges on success.
//
// Usage:
//   WORKER_CONCURRENCY=1 DATABASE_URL=... REDIS_URL=... tsx src/worker.ts
//
// ---------------------------------------------------------------------------

import Redis from 'ioredis';
import { createDb } from '@rv-trax/db';
import { processPipelineEvent } from './pipeline/index.js';
import type { TrackerEvent } from './types.js';
import type { WorkerMetrics } from './pipeline/types.js';

// ── Configuration ─────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const DATABASE_URL = process.env.DATABASE_URL ?? '';
const STREAM_KEY = 'iot:events';
const CONSUMER_GROUP = 'pipeline-workers';
const CONSUMER_NAME = `worker-${process.pid}-${Date.now()}`;
const BLOCK_MS = 5000; // 5 second block timeout
const BATCH_SIZE = 10; // Read up to 10 events at a time
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY ?? '1', 10);

// ── State ─────────────────────────────────────────────────────────────────

let running = true;
const metrics: WorkerMetrics = {
  eventsProcessed: 0,
  eventsErrored: 0,
  eventsSkipped: 0,
  avgProcessingMs: 0,
  lastEventAt: null,
  startedAt: Date.now(),
};

// Running total for computing rolling average
let totalProcessingMs = 0;

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  if (!DATABASE_URL) {
    console.error('[worker] DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log(`[worker] Starting pipeline worker ${CONSUMER_NAME}`);
  console.log(`[worker] Redis: ${REDIS_URL}`);
  console.log(`[worker] Stream: ${STREAM_KEY}, Group: ${CONSUMER_GROUP}`);
  console.log(`[worker] Concurrency: ${CONCURRENCY}, Batch size: ${BATCH_SIZE}`);

  // Create connections
  const redis = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null, // Required for blocking commands
    enableReadyCheck: true,
    retryStrategy: (times) => Math.min(times * 200, 5000),
  });

  const { db, client: pgClient } = createDb(DATABASE_URL);

  // Ensure consumer group exists
  try {
    await redis.xgroup('CREATE', STREAM_KEY, CONSUMER_GROUP, '0', 'MKSTREAM');
    console.log(`[worker] Created consumer group "${CONSUMER_GROUP}"`);
  } catch (err: unknown) {
    // BUSYGROUP means the group already exists — that's fine
    if (err instanceof Error && err.message.includes('BUSYGROUP')) {
      console.log(`[worker] Consumer group "${CONSUMER_GROUP}" already exists`);
    } else {
      throw err;
    }
  }

  // Register shutdown handlers
  const shutdown = async () => {
    console.log('[worker] Shutting down gracefully...');
    running = false;
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  // Main consumption loop
  console.log('[worker] Listening for events...');

  while (running) {
    try {
      await consumeBatch(redis, db);
    } catch (err) {
      if (!running) break; // Shutdown in progress
      console.error('[worker] Error in consume loop:', err);
      // Back off briefly before retrying
      await sleep(1000);
    }
  }

  // Cleanup
  console.log('[worker] Closing connections...');
  console.log(`[worker] Final metrics: ${JSON.stringify(metrics)}`);

  redis.disconnect();
  await pgClient.end();

  console.log('[worker] Shutdown complete');
  process.exit(0);
}

// ── Batch consumption ─────────────────────────────────────────────────────

/**
 * Read a batch of events from the stream and process them.
 *
 * Uses XREADGROUP with BLOCK to efficiently wait for new events.
 * The ">" special ID means "only deliver messages never delivered to
 * this consumer before."
 */
async function consumeBatch(redis: Redis, db: ReturnType<typeof createDb>['db']): Promise<void> {
  // XREADGROUP GROUP <group> <consumer> COUNT <n> BLOCK <ms> STREAMS <key> >
  const response = await redis.xreadgroup(
    'GROUP',
    CONSUMER_GROUP,
    CONSUMER_NAME,
    'COUNT',
    BATCH_SIZE,
    'BLOCK',
    BLOCK_MS,
    'STREAMS',
    STREAM_KEY,
    '>',
  );

  if (!response || response.length === 0) {
    return; // Timeout — no events available
  }

  // response is [[streamKey, [[messageId, [field, value, ...]], ...]]]
  const streamEntry = response[0];
  if (!streamEntry) return;
  const [, messages] = streamEntry as [string, [string, string[]][]];

  if (CONCURRENCY <= 1) {
    // Sequential processing — safest for avoiding race conditions on same unit
    for (const [messageId, fields] of messages) {
      await processMessage(messageId, fields, redis, db);
    }
  } else {
    // Parallel processing with bounded concurrency
    const chunks = chunkArray(messages, CONCURRENCY);
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(([messageId, fields]: [string, string[]]) =>
          processMessage(messageId, fields, redis, db),
        ),
      );
    }
  }
}

// ── Single message processing ─────────────────────────────────────────────

/**
 * Process a single message from the stream.
 * Deserializes the event, runs the pipeline, and ACKs on success.
 * Errors are caught per-event so one bad event doesn't crash the worker.
 */
async function processMessage(
  messageId: string,
  fields: string[],
  redis: Redis,
  db: ReturnType<typeof createDb>['db'],
): Promise<void> {
  let event: TrackerEvent;

  try {
    // Fields are [key, value, key, value, ...]
    event = deserializeStreamFields(fields);
  } catch (err) {
    console.error(`[worker] Failed to deserialize message ${messageId}:`, err);
    metrics.eventsErrored++;
    // ACK the malformed message so it doesn't block the stream
    await ackMessage(redis, messageId);
    return;
  }

  try {
    const pipelineResult = await processPipelineEvent(event, db, redis);

    metrics.lastEventAt = Date.now();

    if (pipelineResult.completed) {
      metrics.eventsProcessed++;
    } else {
      metrics.eventsSkipped++;
    }

    totalProcessingMs += pipelineResult.processingMs;
    const totalEvents = metrics.eventsProcessed + metrics.eventsSkipped;
    metrics.avgProcessingMs =
      totalEvents > 0 ? Math.round(totalProcessingMs / totalEvents) : 0;

    if (pipelineResult.skipReason) {
      console.log(
        `[worker] ${event.device_eui}: skipped (${pipelineResult.skipReason}) [${pipelineResult.processingMs}ms]`,
      );
    } else {
      console.log(
        `[worker] ${event.device_eui}: processed ` +
          `[pos=${pipelineResult.position?.source ?? 'none'}, ` +
          `zone=${pipelineResult.zoneSnap?.zone ?? 'none'}, ` +
          `moved=${pipelineResult.movement?.moved ?? false}, ` +
          `fences=${pipelineResult.geoFenceEvents.length}, ` +
          `alerts=${pipelineResult.alertsGenerated.length}] ` +
          `[${pipelineResult.processingMs}ms]`,
      );
    }

    // ACK on success
    await ackMessage(redis, messageId);
  } catch (err) {
    console.error(
      `[worker] Pipeline error for ${event.device_eui} (msg ${messageId}):`,
      err,
    );
    metrics.eventsErrored++;

    // ACK even on pipeline error to prevent infinite re-processing.
    // In production, you might want to move failed events to a dead-letter
    // stream instead. For now, we log the error and move on.
    await ackMessage(redis, messageId);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Acknowledge a message in the consumer group.
 */
async function ackMessage(redis: Redis, messageId: string): Promise<void> {
  try {
    await redis.xack(STREAM_KEY, CONSUMER_GROUP, messageId);
  } catch (err) {
    console.error(`[worker] Failed to ACK message ${messageId}:`, err);
  }
}

/**
 * Deserialize Redis stream fields (flat key-value array) into a TrackerEvent.
 *
 * The ingestion service stores the event as a JSON blob in the "data" field,
 * OR as individual fields. We support both formats.
 */
function deserializeStreamFields(fields: string[]): TrackerEvent {
  // Build key-value map from flat array
  const map: Record<string, string> = {};
  for (let i = 0; i < fields.length; i += 2) {
    const key = fields[i];
    const value = fields[i + 1];
    if (key !== undefined) {
      map[key] = value ?? '';
    }
  }

  // If there's a "data" field, it's a JSON-encoded TrackerEvent
  if (map.data) {
    return JSON.parse(map.data) as TrackerEvent;
  }

  // Otherwise, reconstruct from individual fields
  return {
    device_eui: map.device_eui ?? '',
    timestamp: map.timestamp ?? new Date().toISOString(),
    latitude: map.latitude ? parseFloat(map.latitude) : null,
    longitude: map.longitude ? parseFloat(map.longitude) : null,
    altitude: map.altitude ? parseFloat(map.altitude) : null,
    accuracy_meters: map.accuracy_meters ? parseFloat(map.accuracy_meters) : null,
    rssi: parseInt(map.rssi ?? '-100', 10),
    snr: parseFloat(map.snr ?? '0'),
    battery_mv: parseInt(map.battery_mv ?? '0', 10),
    battery_pct: parseInt(map.battery_pct ?? '0', 10),
    motion_detected: map.motion_detected === '1' || map.motion_detected === 'true',
    gateway_id: map.gateway_id ?? '',
    gateway_rssi: parseInt(map.gateway_rssi ?? map.rssi ?? '-100', 10),
    raw_payload: map.raw_payload ?? null,
    deduplication_id: map.deduplication_id ?? '',
  };
}

/**
 * Split an array into chunks of a given size.
 */
function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

/**
 * Sleep for the given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Start ─────────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('[worker] Fatal error:', err);
  process.exit(1);
});
