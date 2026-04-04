// ---------------------------------------------------------------------------
// @rv-trax/iot-ingest — MQTT subscriber for ChirpStack events
// ---------------------------------------------------------------------------

import mqtt from 'mqtt';
import type { MqttClient } from 'mqtt';
import type { Redis } from 'ioredis';
import type { Database } from '@rv-trax/db';
import type { FastifyBaseLogger } from 'fastify';
import { normalizeChirpStackEvent } from './parser.js';
import { validateAndEnqueue } from '../validation/validator.js';
import type { AppConfig } from '../types.js';

// ── Module state ────────────────────────────────────────────────────────────

let client: MqttClient | null = null;

// ── ChirpStack MQTT topics ─────────────────────────────────────────────────

const CHIRPSTACK_TOPICS = [
  'application/+/device/+/event/up',     // Uplink data (location updates)
  'application/+/device/+/event/status', // Device status events
  'application/+/device/+/event/join',   // Device join events
];

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Connect to the MQTT broker, subscribe to ChirpStack topics, and begin
 * processing incoming messages.
 */
export function startMqttSubscriber(
  config: AppConfig,
  redis: Redis,
  db: Database,
  logger: FastifyBaseLogger,
): void {
  const { brokerUrl, username, password } = config.mqtt;

  logger.info({ brokerUrl }, 'Connecting to MQTT broker');

  client = mqtt.connect(brokerUrl, {
    username,
    password,
    clientId: `rv-trax-iot-ingest-${process.pid}`,
    clean: true,
    reconnectPeriod: 5000,    // Retry every 5 seconds
    connectTimeout: 30_000,   // 30 second connection timeout
  });

  // ── Connection lifecycle ────────────────────────────────────────────────

  client.on('connect', () => {
    logger.info('MQTT connected, subscribing to ChirpStack topics');

    client!.subscribe(CHIRPSTACK_TOPICS, { qos: 1 }, (err, granted) => {
      if (err) {
        logger.error({ err }, 'Failed to subscribe to MQTT topics');
        return;
      }
      for (const sub of granted ?? []) {
        logger.info({ topic: sub.topic, qos: sub.qos }, 'Subscribed to MQTT topic');
      }
    });
  });

  client.on('reconnect', () => {
    logger.warn('MQTT reconnecting...');
  });

  client.on('disconnect', () => {
    logger.warn('MQTT disconnected');
  });

  client.on('offline', () => {
    logger.warn('MQTT client offline');
  });

  client.on('error', (err) => {
    logger.error({ err }, 'MQTT client error');
  });

  // ── Message handling ────────────────────────────────────────────────────

  client.on('message', (topic: string, payload: Buffer) => {
    // Fire-and-forget — we do not want to block the MQTT event loop.
    // Errors are logged but never thrown back to the MQTT client.
    void handleMessage(topic, payload, redis, db, config, logger);
  });
}

/**
 * Gracefully disconnect from the MQTT broker.
 */
export async function stopMqttSubscriber(logger: FastifyBaseLogger): Promise<void> {
  if (!client) return;

  return new Promise<void>((resolve) => {
    client!.end(false, () => {
      logger.info('MQTT client disconnected');
      client = null;
      resolve();
    });
  });
}

// ── Internal message handler ────────────────────────────────────────────────

async function handleMessage(
  topic: string,
  payload: Buffer,
  redis: Redis,
  db: Database,
  config: AppConfig,
  logger: FastifyBaseLogger,
): Promise<void> {
  const correlationId = `iot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const log = logger.child({ correlationId, topic });

  try {
    const event = normalizeChirpStackEvent(topic, payload);

    if (!event) {
      // Non-uplink event (status, join) or unparseable — silently skip
      log.debug('Ignoring non-uplink or unparseable MQTT message');
      return;
    }

    const result = await validateAndEnqueue(event, redis, db, config);

    if (result.accepted) {
      log.info(
        { deviceEui: event.device_eui, dedupId: event.deduplication_id },
        'Event accepted and enqueued',
      );
    } else {
      log.debug(
        { deviceEui: event.device_eui, reason: result.reason },
        'Event rejected',
      );
    }
  } catch (err) {
    log.error({ err }, 'Unhandled error processing MQTT message');
  }
}
