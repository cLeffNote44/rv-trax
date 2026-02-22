// ---------------------------------------------------------------------------
// @rv-trax/iot-ingest — Configuration loader
// ---------------------------------------------------------------------------

import type { AppConfig } from './types.js';

/**
 * Reads configuration from environment variables with sensible defaults.
 * Throws if required variables (DATABASE_URL) are missing.
 */
export function loadConfig(): AppConfig {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error(
      'Missing required environment variable: DATABASE_URL. ' +
        'Set it to a PostgreSQL connection string (e.g. postgres://user:pass@host:5432/db).',
    );
  }

  return {
    mqtt: {
      brokerUrl: process.env['MQTT_BROKER_URL'] ?? 'mqtt://localhost:1883',
      username: process.env['MQTT_USERNAME'] ?? undefined,
      password: process.env['MQTT_PASSWORD'] ?? undefined,
    },
    redis: {
      url: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
      streamKey: process.env['REDIS_STREAM_KEY'] ?? 'iot:events',
      streamMaxLen: parseInt(process.env['REDIS_STREAM_MAX_LEN'] ?? '100000', 10),
    },
    databaseUrl,
    host: process.env['IOT_INGEST_HOST'] ?? '0.0.0.0',
    port: parseInt(process.env['IOT_INGEST_PORT'] ?? '3002', 10),
    chirpstackWebhookSecret: process.env['CHIRPSTACK_WEBHOOK_SECRET'] ?? undefined,
    rateLimitSeconds: parseInt(process.env['RATE_LIMIT_SECONDS'] ?? '5', 10),
    dedupTtlSeconds: parseInt(process.env['DEDUP_TTL_SECONDS'] ?? '60', 10),
  };
}
