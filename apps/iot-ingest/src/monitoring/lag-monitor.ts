// ---------------------------------------------------------------------------
// @rv-trax/iot-ingest — Pipeline lag monitor
// ---------------------------------------------------------------------------

import type { Redis } from 'ioredis';
import type { FastifyBaseLogger } from 'fastify';

export interface LagMonitorConfig {
  /** Redis stream key to monitor */
  streamKey: string;
  /** Check interval in milliseconds (default: 30000) */
  intervalMs?: number;
  /** Lag threshold in seconds before warning (default: 60) */
  warnThresholdSec?: number;
  /** Lag threshold in seconds before critical alert (default: 300) */
  criticalThresholdSec?: number;
}

interface LagSnapshot {
  queueDepth: number;
  oldestEntryAgeSec: number | null;
  status: 'ok' | 'warning' | 'critical';
  checkedAt: string;
}

let timer: ReturnType<typeof setInterval> | null = null;
let latestSnapshot: LagSnapshot = {
  queueDepth: 0,
  oldestEntryAgeSec: null,
  status: 'ok',
  checkedAt: new Date().toISOString(),
};

/**
 * Start periodic lag monitoring on the Redis stream.
 */
export function startLagMonitor(
  redis: Redis,
  logger: FastifyBaseLogger,
  config: LagMonitorConfig,
): void {
  const {
    streamKey,
    intervalMs = 30_000,
    warnThresholdSec = 60,
    criticalThresholdSec = 300,
  } = config;

  logger.info(
    { streamKey, intervalMs, warnThresholdSec, criticalThresholdSec },
    'Starting pipeline lag monitor',
  );

  const check = async () => {
    try {
      const depth = await redis.xlen(streamKey);

      let oldestAgeSec: number | null = null;

      if (depth > 0) {
        // Read the oldest entry to calculate lag
        const entries = await redis.xrange(streamKey, '-', '+', 'COUNT', 1);
        if (entries.length > 0) {
          // Redis stream IDs are timestamp-based: "<millisecondsTime>-<sequenceNumber>"
          const entryId = entries[0]![0];
          const entryTimestamp = parseInt(entryId.split('-')[0]!, 10);
          oldestAgeSec = Math.floor((Date.now() - entryTimestamp) / 1000);
        }
      }

      let status: 'ok' | 'warning' | 'critical' = 'ok';
      if (oldestAgeSec !== null) {
        if (oldestAgeSec >= criticalThresholdSec) {
          status = 'critical';
          logger.error(
            { queueDepth: depth, lagSeconds: oldestAgeSec, streamKey },
            'CRITICAL: IoT pipeline lag exceeds threshold — events are backing up',
          );
        } else if (oldestAgeSec >= warnThresholdSec) {
          status = 'warning';
          logger.warn(
            { queueDepth: depth, lagSeconds: oldestAgeSec, streamKey },
            'WARNING: IoT pipeline lag above normal — processing may be falling behind',
          );
        }
      }

      latestSnapshot = {
        queueDepth: depth,
        oldestEntryAgeSec: oldestAgeSec,
        status,
        checkedAt: new Date().toISOString(),
      };

      logger.debug(latestSnapshot, 'Pipeline lag check complete');
    } catch (err) {
      logger.error({ err, streamKey }, 'Failed to check pipeline lag');
    }
  };

  // Run immediately, then on interval
  void check();
  timer = setInterval(() => void check(), intervalMs);
}

/**
 * Stop the lag monitor.
 */
export function stopLagMonitor(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/**
 * Get the latest lag snapshot (for health/metrics endpoints).
 */
export function getLagSnapshot(): LagSnapshot {
  return { ...latestSnapshot };
}
