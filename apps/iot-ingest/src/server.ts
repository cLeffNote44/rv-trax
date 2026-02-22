// ---------------------------------------------------------------------------
// @rv-trax/iot-ingest — Main server entry point
// ---------------------------------------------------------------------------

import Fastify from 'fastify';
import cors from '@fastify/cors';
import Redis from 'ioredis';
import { createDb } from '@rv-trax/db';
import { loadConfig } from './config.js';
import { startMqttSubscriber, stopMqttSubscriber } from './mqtt/subscriber.js';
import webhookRoutes from './routes/webhook.js';
import { getMetrics } from './utils/metrics.js';

const PKG_VERSION = '0.1.0';

async function buildApp() {
  const config = loadConfig();

  // ── Fastify instance ────────────────────────────────────────────────────

  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport:
        process.env['NODE_ENV'] !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    genReqId: () => crypto.randomUUID(),
  });

  // ── Third-party plugins ─────────────────────────────────────────────────

  await app.register(cors, {
    origin: process.env['CORS_ORIGIN'] ?? true,
    credentials: true,
  });

  // ── External connections ────────────────────────────────────────────────

  const redis = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
    retryStrategy(times) {
      const delay = Math.min(times * 500, 5000);
      app.log.warn({ attempt: times, delayMs: delay }, 'Redis reconnecting');
      return delay;
    },
  });

  redis.on('connect', () => app.log.info('Redis connected'));
  redis.on('error', (err) => app.log.error({ err }, 'Redis error'));

  const { db, client: pgClient } = createDb(config.databaseUrl);

  // ── MQTT subscriber ─────────────────────────────────────────────────────

  startMqttSubscriber(config, redis, db, app.log);

  // ── HTTP webhook routes ─────────────────────────────────────────────────

  await app.register(webhookRoutes, {
    prefix: '/api/v1/webhook',
    redis,
    db,
    config,
  });

  // ── Health endpoint ─────────────────────────────────────────────────────

  app.get('/health', async () => {
    const metrics = await getMetrics(redis, config.redis.streamKey);
    return {
      status: 'ok',
      version: PKG_VERSION,
      timestamp: new Date().toISOString(),
      uptime_seconds: metrics.uptime_seconds,
      events_processed: metrics.events_processed,
      queue_depth: metrics.queue_depth,
    };
  });

  // ── Metrics endpoint ────────────────────────────────────────────────────

  app.get('/metrics', async () => {
    return getMetrics(redis, config.redis.streamKey);
  });

  // ── Graceful shutdown ───────────────────────────────────────────────────

  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    try {
      // 1. Stop accepting MQTT messages
      await stopMqttSubscriber(app.log);

      // 2. Close HTTP server (stop accepting new requests, drain in-flight)
      await app.close();

      // 3. Disconnect Redis
      redis.disconnect();
      app.log.info('Redis disconnected');

      // 4. Close PostgreSQL connection pool
      await pgClient.end();
      app.log.info('PostgreSQL disconnected');

      app.log.info('Shutdown complete');
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  return { app, config };
}

// ── Start server ────────────────────────────────────────────────────────────

async function start() {
  const { app, config } = await buildApp();

  try {
    await app.listen({ host: config.host, port: config.port });
    app.log.info(
      `RV Trax IoT Ingest v${PKG_VERSION} listening on ${config.host}:${config.port}`,
    );
  } catch (err) {
    app.log.fatal(err, 'Failed to start IoT Ingest server');
    process.exit(1);
  }
}

start();

export { buildApp };
