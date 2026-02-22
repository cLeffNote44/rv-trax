// ---------------------------------------------------------------------------
// @rv-trax/iot-ingest — HTTP webhook routes for ChirpStack and generic ingest
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Redis } from 'ioredis';
import type { Database } from '@rv-trax/db';
import { z } from 'zod';
import { normalizeChirpStackWebhook } from '../mqtt/parser.js';
import { validateAndEnqueue } from '../validation/validator.js';
import type { AppConfig, TrackerEvent } from '../types.js';

// ── Zod schemas for request validation ──────────────────────────────────────

const chirpStackBodySchema = z.object({
  deduplicationId: z.string(),
  time: z.string(),
  deviceInfo: z.object({
    devEui: z.string(),
    deviceProfileName: z.string().optional().default(''),
    applicationId: z.string().optional().default(''),
  }),
  rxInfo: z.array(
    z.object({
      gatewayId: z.string(),
      rssi: z.number(),
      snr: z.number(),
    }),
  ).optional().default([]),
  txInfo: z.object({
    frequency: z.number(),
  }).optional().default({ frequency: 0 }),
  object: z.record(z.unknown()).optional(),
  data: z.string().optional(),
}).passthrough();

const genericBodySchema = z.object({
  device_eui: z.string().min(1),
  timestamp: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  altitude: z.number().nullable().optional().default(null),
  accuracy_meters: z.number().nullable().optional().default(null),
  rssi: z.number(),
  snr: z.number(),
  battery_mv: z.number(),
  battery_pct: z.number(),
  motion_detected: z.boolean().optional().default(false),
  gateway_id: z.string(),
  gateway_rssi: z.number(),
  raw_payload: z.string().nullable().optional().default(null),
  deduplication_id: z.string(),
});

// ── Route registration ──────────────────────────────────────────────────────

export default async function webhookRoutes(
  app: FastifyInstance,
  opts: { redis: Redis; db: Database; config: AppConfig },
): Promise<void> {
  const { redis, db, config } = opts;

  // ── POST /chirpstack — ChirpStack HTTP integration webhook ────────────

  app.post('/chirpstack', async (request: FastifyRequest, reply: FastifyReply) => {
    // Optional shared secret verification
    if (config.chirpstackWebhookSecret) {
      const signature = request.headers['x-chirpstack-signature'];
      if (signature !== config.chirpstackWebhookSecret) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid or missing X-ChirpStack-Signature header',
        });
      }
    }

    // Parse and validate the request body
    const parsed = chirpStackBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid ChirpStack webhook payload',
        details: parsed.error.issues,
      });
    }

    // Normalize ChirpStack payload to TrackerEvent
    const event = normalizeChirpStackWebhook(parsed.data as Record<string, unknown>);
    if (!event) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Could not extract tracker event from ChirpStack payload',
      });
    }

    // Validate and enqueue
    const result = await validateAndEnqueue(event, redis, db, config);

    if (!result.accepted) {
      const statusCode = result.reason === 'Rate limited' ? 429 : 400;
      return reply.status(statusCode).send({
        error: statusCode === 429 ? 'Too Many Requests' : 'Bad Request',
        message: result.reason,
      });
    }

    return reply.status(200).send({
      status: 'accepted',
      device_eui: event.device_eui,
      deduplication_id: event.deduplication_id,
    });
  });

  // ── POST /generic — Generic webhook for future LoRa network servers ───

  app.post('/generic', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = genericBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Invalid generic webhook payload',
        details: parsed.error.issues,
      });
    }

    const event: TrackerEvent = {
      device_eui: parsed.data.device_eui,
      timestamp: parsed.data.timestamp,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      altitude: parsed.data.altitude,
      accuracy_meters: parsed.data.accuracy_meters,
      rssi: parsed.data.rssi,
      snr: parsed.data.snr,
      battery_mv: parsed.data.battery_mv,
      battery_pct: parsed.data.battery_pct,
      motion_detected: parsed.data.motion_detected,
      gateway_id: parsed.data.gateway_id,
      gateway_rssi: parsed.data.gateway_rssi,
      raw_payload: parsed.data.raw_payload,
      deduplication_id: parsed.data.deduplication_id,
    };

    const result = await validateAndEnqueue(event, redis, db, config);

    if (!result.accepted) {
      const statusCode = result.reason === 'Rate limited' ? 429 : 400;
      return reply.status(statusCode).send({
        error: statusCode === 429 ? 'Too Many Requests' : 'Bad Request',
        message: result.reason,
      });
    }

    return reply.status(200).send({
      status: 'accepted',
      device_eui: event.device_eui,
      deduplication_id: event.deduplication_id,
    });
  });
}
