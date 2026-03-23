// ---------------------------------------------------------------------------
// RV Trax API — Pricing Suggestions routes (GET /api/v1/pricing/*)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { enforceTenant } from '../middleware/tenant.js';
import { computePricingSuggestions } from '../services/pricing-suggestions.js';
import { z } from 'zod';

// ── Local param schema -------------------------------------------------------

const unitIdSchema = z.object({
  unitId: z.string().uuid(),
});

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export default async function pricingRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth + tenant
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── GET / — List pricing suggestions for all aging units

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const suggestions = await computePricingSuggestions(app.db, request.dealershipId);

    return reply.status(200).send({ data: suggestions });
  });

  // ── GET /:unitId — Get pricing suggestion for a specific unit

  app.get('/:unitId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { unitId } = unitIdSchema.parse(request.params);

    const suggestions = await computePricingSuggestions(app.db, request.dealershipId, unitId);

    if (suggestions.length === 0) {
      return reply.status(404).send({
        error: {
          code: 'NOT_FOUND',
          message:
            'No pricing suggestion available for this unit. The unit may not exist, may be in a protected status (hold/deposit/sold), or may not have sufficient data.',
          details: null,
          request_id: request.id,
        },
      });
    }

    return reply.status(200).send({ data: suggestions[0] });
  });
}
