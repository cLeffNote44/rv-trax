// ---------------------------------------------------------------------------
// RV Trax API — Staging move operations (extracted from staging.ts)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { stagingPlans, stagingAssignments } from '@rv-trax/db';
import { AuditAction } from '@rv-trax/shared';
import { notFound, badRequest } from '../../utils/errors.js';
import { logAction } from '../../services/audit.js';
import { computeMoveList } from '../../services/staging.js';
import type { StagingRule } from '../../services/staging.js';

/**
 * Registers move-related sub-routes on a staging plan.
 * Called from the main staging routes plugin.
 */
export function registerMoveRoutes(app: FastifyInstance): void {
  // ── GET /:id/move-list — compute optimized move order ------------------

  app.get('/:id/move-list', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [plan] = await app.db
      .select()
      .from(stagingPlans)
      .where(and(eq(stagingPlans.id, id), eq(stagingPlans.dealershipId, request.dealershipId)))
      .limit(1);

    if (!plan) throw notFound('Staging plan not found');

    if (!plan.isActive) {
      throw badRequest('Plan must be activated before generating a move list');
    }

    const rules: StagingRule[] = plan.rules
      ? (JSON.parse(plan.rules as string) as StagingRule[])
      : [];

    const moves = await computeMoveList(app.db, id, plan.lotId!, request.dealershipId, rules);

    // Create assignment records for each move
    const movesWithIds = await Promise.all(
      moves.map(async (move) => {
        const [assignment] = await app.db
          .insert(stagingAssignments)
          .values({
            planId: id,
            unitId: move.unitId,
            targetRow: move.targetRow,
            targetSpot: move.targetSpot,
            status: 'pending',
          })
          .returning();

        return {
          assignment_id: assignment!.id,
          ...move,
        };
      }),
    );

    return reply.status(200).send({
      data: movesWithIds,
      summary: {
        total_moves: moves.length,
        total_distance_m: Math.round(moves.reduce((sum, m) => sum + m.distanceM, 0) * 100) / 100,
      },
    });
  });

  // ── POST /:id/moves/:assignmentId/complete — mark move completed ------

  app.post(
    '/:id/moves/:assignmentId/complete',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id, assignmentId } = request.params as {
        id: string;
        assignmentId: string;
      };

      const [plan] = await app.db
        .select({ id: stagingPlans.id })
        .from(stagingPlans)
        .where(and(eq(stagingPlans.id, id), eq(stagingPlans.dealershipId, request.dealershipId)))
        .limit(1);

      if (!plan) throw notFound('Staging plan not found');

      const [assignment] = await app.db
        .select()
        .from(stagingAssignments)
        .where(and(eq(stagingAssignments.id, assignmentId), eq(stagingAssignments.planId, id)))
        .limit(1);

      if (!assignment) throw notFound('Assignment not found');
      if (assignment.status === 'completed') throw badRequest('Assignment is already completed');
      if (assignment.status === 'skipped')
        throw badRequest('Assignment was skipped and cannot be completed');

      const [updated] = await app.db
        .update(stagingAssignments)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(stagingAssignments.id, assignmentId))
        .returning();

      await logAction(app.db, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: AuditAction.STATUS_CHANGE,
        entityType: 'staging_assignment',
        entityId: assignmentId,
        changes: { status: 'completed' },
        ipAddress: request.ip,
      });

      return reply.status(200).send({ data: updated });
    },
  );

  // ── POST /:id/moves/:assignmentId/skip — skip a move ------------------

  app.post(
    '/:id/moves/:assignmentId/skip',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id, assignmentId } = request.params as {
        id: string;
        assignmentId: string;
      };

      const [plan] = await app.db
        .select({ id: stagingPlans.id })
        .from(stagingPlans)
        .where(and(eq(stagingPlans.id, id), eq(stagingPlans.dealershipId, request.dealershipId)))
        .limit(1);

      if (!plan) throw notFound('Staging plan not found');

      const [assignment] = await app.db
        .select()
        .from(stagingAssignments)
        .where(and(eq(stagingAssignments.id, assignmentId), eq(stagingAssignments.planId, id)))
        .limit(1);

      if (!assignment) throw notFound('Assignment not found');
      if (assignment.status === 'completed')
        throw badRequest('Assignment is already completed and cannot be skipped');
      if (assignment.status === 'skipped') throw badRequest('Assignment is already skipped');

      const [updated] = await app.db
        .update(stagingAssignments)
        .set({ status: 'skipped' })
        .where(eq(stagingAssignments.id, assignmentId))
        .returning();

      await logAction(app.db, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: AuditAction.STATUS_CHANGE,
        entityType: 'staging_assignment',
        entityId: assignmentId,
        changes: { status: 'skipped' },
        ipAddress: request.ip,
      });

      return reply.status(200).send({ data: updated });
    },
  );
}
