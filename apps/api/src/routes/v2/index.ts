// ---------------------------------------------------------------------------
// RV Trax API — v2 namespace
//
// API v2 introduces:
//   - Standardized envelope: { data, meta, errors }
//   - Offset pagination (page/limit) alongside cursor pagination
//   - Expanded unit responses with embedded relations
//   - Deprecation headers on v1 endpoints (when v2 equivalents exist)
//
// Strategy:
//   - v2 routes are registered alongside v1 (both work simultaneously)
//   - v1 is not removed until v3 (minimum 12-month deprecation window)
//   - New features ship in v2 only; v1 gets bug fixes only
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { enforceTenant } from '../../middleware/tenant.js';
import { registerV2UnitRoutes } from './units.js';
import { registerV2HealthRoutes } from './health.js';

/**
 * Registers all v2 API routes.
 *
 * Called from server.ts:
 *   await app.register(v2Routes, { prefix: '/api/v2' });
 */
export default async function v2Routes(app: FastifyInstance): Promise<void> {
  // v2 uses the same auth + tenant middleware
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // v2 adds standard response envelope + deprecation headers
  app.addHook('onSend', async (_request, reply, payload) => {
    // Add API version header
    reply.header('X-API-Version', '2');
    reply.header('X-RateLimit-Policy', 'sliding-window');
    return payload;
  });

  // Register v2 route modules
  registerV2HealthRoutes(app);
  registerV2UnitRoutes(app);

  app.log.info('API v2 routes registered');
}
