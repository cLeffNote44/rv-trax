// ---------------------------------------------------------------------------
// RV Trax API — Main server entry point
// ---------------------------------------------------------------------------

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import multipart from '@fastify/multipart';

import dbPlugin from './plugins/db.js';
import authPlugin from './plugins/auth.js';
import { registerErrorHandler } from './utils/errors.js';

import authRoutes from './routes/auth.js';
import unitRoutes from './routes/units.js';
import trackerRoutes from './routes/trackers.js';
import lotRoutes from './routes/lots.js';
import auditRoutes from './routes/audit.js';
import { registerPhase4Routes } from './server-additions.js';
import geofenceRoutes from './routes/geofences.js';
import alertRuleRoutes from './routes/alert-rules.js';
import alertRoutes from './routes/alerts.js';
import stagingRoutes from './routes/staging.js';
import workOrderRoutes from './routes/work-orders.js';
import recallRoutes from './routes/recalls.js';
import analyticsRoutes from './routes/analytics.js';
import reportRoutes from './routes/reports.js';
import billingRoutes from './routes/billing.js';
import settingsRoutes from './routes/settings.js';
import adminRoutes from './routes/admin.js';
import groupRoutes from './routes/groups.js';
import transferRoutes from './routes/transfers.js';
import whiteLabelRoutes from './routes/white-label.js';
import publicApiRoutes from './routes/public-api.js';
import apiKeyRoutes from './routes/api-keys.js';
import webhookRoutes from './routes/webhooks.js';
import dmsRoutes from './routes/dms.js';
import widgetRoutes from './routes/widget.js';
import deviceRoutes from './routes/devices.js';

const API_HOST = process.env['API_HOST'] ?? '0.0.0.0';
const API_PORT = parseInt(process.env['API_PORT'] ?? '3001', 10);
const PKG_VERSION = '0.1.0';

async function buildApp() {
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

  // ── Register error handler ------------------------------------------------
  registerErrorHandler(app);

  // ── Third-party plugins ---------------------------------------------------
  await app.register(cors, {
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  const cookieSecret = process.env['COOKIE_SECRET'] ?? process.env['JWT_SECRET'];
  if (!cookieSecret && process.env['NODE_ENV'] === 'production') {
    throw new Error('COOKIE_SECRET or JWT_SECRET environment variable is required in production');
  }

  await app.register(cookie, {
    secret: cookieSecret ?? 'dev-cookie-secret',
  });

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB
    },
  });

  // ── Swagger ---------------------------------------------------------------
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'RV Trax API',
        description: 'Real-time asset tracking system for RV dealerships',
        version: PKG_VERSION,
      },
      servers: [
        {
          url: `http://${API_HOST}:${API_PORT}`,
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  if (process.env['NODE_ENV'] !== 'production') {
    await app.register(swaggerUi, {
      routePrefix: '/api/docs',
    });
  }

  // ── Custom plugins --------------------------------------------------------
  await app.register(dbPlugin);
  await app.register(authPlugin);

  // ── Health checks ---------------------------------------------------------

  // Liveness — always returns ok if the process is running
  app.get('/health', async () => ({
    status: 'ok',
    version: PKG_VERSION,
    timestamp: new Date().toISOString(),
  }));

  // Readiness — verifies DB and Redis are reachable
  app.get('/ready', async (_request, reply) => {
    const checks: Record<string, 'ok' | 'fail'> = { db: 'fail', redis: 'fail' };

    try {
      await app.db.execute({ sql: 'SELECT 1' } as any);
      checks['db'] = 'ok';
    } catch { /* db unreachable */ }

    try {
      const pong = await app.redis.ping();
      if (pong === 'PONG') checks['redis'] = 'ok';
    } catch { /* redis unreachable */ }

    const allOk = Object.values(checks).every((v) => v === 'ok');

    return reply.status(allOk ? 200 : 503).send({
      status: allOk ? 'ready' : 'not_ready',
      checks,
      version: PKG_VERSION,
      timestamp: new Date().toISOString(),
    });
  });

  // ── Routes ----------------------------------------------------------------
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(unitRoutes, { prefix: '/api/v1/units' });
  await app.register(trackerRoutes, { prefix: '/api/v1/trackers' });
  await app.register(lotRoutes, { prefix: '/api/v1/lots' });
  await app.register(auditRoutes, { prefix: '/api/v1/audit-log' });

  // Phase 4: Location engine, WebSocket, gateways
  await registerPhase4Routes(app);

  // Phase 5: Geo-fencing & alerts
  await app.register(geofenceRoutes, { prefix: '/api/v1' });
  await app.register(alertRuleRoutes, { prefix: '/api/v1/alert-rules' });
  await app.register(alertRoutes, { prefix: '/api/v1/alerts' });

  // Phase 6: Lot staging & optimization
  await app.register(stagingRoutes, { prefix: '/api/v1/staging-plans' });

  // Phase 7: Service workflows
  await app.register(workOrderRoutes, { prefix: '/api/v1/work-orders' });
  await app.register(recallRoutes, { prefix: '/api/v1/recalls' });

  // Phase 8: Analytics & reporting
  await app.register(analyticsRoutes, { prefix: '/api/v1/analytics' });
  await app.register(reportRoutes, { prefix: '/api/v1/reports' });

  // Phase 9: Billing, settings & admin
  await app.register(billingRoutes, { prefix: '/api/v1/billing' });
  await app.register(settingsRoutes, { prefix: '/api/v1/settings' });
  await app.register(adminRoutes, { prefix: '/api/v1/admin' });

  // Phase 10: Public API, webhooks, DMS & embeddable widget
  await app.register(publicApiRoutes, { prefix: '/api/public/v1' });
  await app.register(apiKeyRoutes, { prefix: '/api/v1/api-keys' });
  await app.register(webhookRoutes, { prefix: '/api/v1/webhooks' });
  await app.register(dmsRoutes, { prefix: '/api/v1/dms' });
  await app.register(widgetRoutes, { prefix: '/api/v1/widget' });
  await app.register(deviceRoutes, { prefix: '/api/v1/devices' });

  // Phase 11: Multi-location & scale
  await app.register(groupRoutes, { prefix: '/api/v1/groups' });
  await app.register(transferRoutes, { prefix: '/api/v1/transfers' });
  await app.register(whiteLabelRoutes, { prefix: '/api/v1/white-label' });

  return app;
}

// ── Start server ------------------------------------------------------------

async function start() {
  const app = await buildApp();

  try {
    await app.listen({ host: API_HOST, port: API_PORT });
    app.log.info(`RV Trax API v${PKG_VERSION} listening on ${API_HOST}:${API_PORT}`);
    app.log.info(`Swagger docs available at http://${API_HOST}:${API_PORT}/api/docs`);
  } catch (err) {
    app.log.fatal(err, 'Failed to start server');
    process.exit(1);
  }

  // ── Graceful shutdown -----------------------------------------------------
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await app.close();
      app.log.info('Server closed');
      process.exit(0);
    } catch (err) {
      app.log.error(err, 'Error during shutdown');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start();

export { buildApp };
