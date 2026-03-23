// ---------------------------------------------------------------------------
// RV Trax API — Staging compliance routes (extracted from staging.ts)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { stagingPlans } from '@rv-trax/db';
import { notFound, badRequest } from '../../utils/errors.js';
import { computeComplianceScore, snapshotCompliance } from '../../services/compliance.js';

/**
 * Registers compliance-related sub-routes on a staging plan.
 * Called from the main staging routes plugin.
 */
export function registerComplianceRoutes(app: FastifyInstance): void {
  // ── GET /:id/compliance — compliance score for the plan's lot ----------

  app.get('/:id/compliance', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [plan] = await app.db
      .select()
      .from(stagingPlans)
      .where(and(eq(stagingPlans.id, id), eq(stagingPlans.dealershipId, request.dealershipId)))
      .limit(1);

    if (!plan) throw notFound('Staging plan not found');

    if (!plan.lotId) {
      throw badRequest('Staging plan has no associated lot');
    }

    const score = await computeComplianceScore(app.db, plan.lotId, request.dealershipId);

    await snapshotCompliance(app.db, plan.lotId, request.dealershipId);

    return reply.status(200).send({ data: score });
  });
}
