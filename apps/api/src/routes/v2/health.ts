// ---------------------------------------------------------------------------
// RV Trax API v2 — Health check (demonstrates v2 envelope format)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyReply } from 'fastify';

export function registerV2HealthRoutes(app: FastifyInstance): void {
  // GET /api/v2/health — v2 health check with standardized envelope
  app.get(
    '/health',
    { preHandler: [] }, // Skip auth for health check
    async (_request, reply: FastifyReply) => {
      return reply.send({
        data: {
          status: 'ok',
          version: '2',
          timestamp: new Date().toISOString(),
        },
        meta: {
          api_version: 2,
          deprecation: null,
        },
        errors: null,
      });
    },
  );
}
