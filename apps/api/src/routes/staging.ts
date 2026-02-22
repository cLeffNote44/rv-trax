// ---------------------------------------------------------------------------
// RV Trax API — Staging plan routes (CRUD + activation, cloning, moves)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { stagingPlans, lots, stagingAssignments } from '@rv-trax/db';
import {
  createStagingPlanSchema,
  updateStagingPlanSchema,
  AuditAction,
} from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, badRequest } from '../utils/errors.js';
import { logAction } from '../services/audit.js';
import { computeMoveList } from '../services/staging.js';
import type { StagingRule } from '../services/staging.js';
import { computeComplianceScore, snapshotCompliance } from '../services/compliance.js';
import { z } from 'zod';

// ── Local query schemas ----------------------------------------------------

const listPlansQuerySchema = z.object({
  lot_id: z.string().uuid().optional(),
  is_template: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

const cloneBodySchema = z.object({
  name: z.string().min(1).optional(),
  is_template: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export default async function stagingRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth + tenant
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── POST / — create staging plan -----------------------------------------

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createStagingPlanSchema.parse(request.body);

    // Verify the lot exists and belongs to this dealership
    const [lot] = await app.db
      .select({ id: lots.id })
      .from(lots)
      .where(
        and(
          eq(lots.id, body.lot_id),
          eq(lots.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!lot) {
      throw notFound('Lot not found');
    }

    const [plan] = await app.db
      .insert(stagingPlans)
      .values({
        lotId: body.lot_id,
        dealershipId: request.dealershipId,
        name: body.name,
        isTemplate: body.is_template,
        rules: JSON.stringify(body.rules),
      })
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.CREATE,
      entityType: 'staging_plan',
      entityId: plan!.id,
      ipAddress: request.ip,
    });

    return reply.status(201).send({ data: plan });
  });

  // ── GET / — list staging plans for dealership ------------------------------

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = listPlansQuerySchema.parse(request.query);

    const conditions = [eq(stagingPlans.dealershipId, request.dealershipId)];

    if (query.lot_id !== undefined) {
      conditions.push(eq(stagingPlans.lotId, query.lot_id));
    }

    if (query.is_template !== undefined) {
      conditions.push(eq(stagingPlans.isTemplate, query.is_template));
    }

    const rows = await app.db
      .select()
      .from(stagingPlans)
      .where(and(...conditions))
      .orderBy(stagingPlans.createdAt);

    return reply.status(200).send({ data: rows });
  });

  // ── GET /:id — get plan detail with computed stats -------------------------

  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [plan] = await app.db
      .select()
      .from(stagingPlans)
      .where(
        and(
          eq(stagingPlans.id, id),
          eq(stagingPlans.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!plan) {
      throw notFound('Staging plan not found');
    }

    // Compute assignment stats
    const assignments = await app.db
      .select({
        status: stagingAssignments.status,
      })
      .from(stagingAssignments)
      .where(eq(stagingAssignments.planId, id));

    const stats = {
      total: assignments.length,
      pending: assignments.filter((a) => a.status === 'pending').length,
      in_progress: assignments.filter((a) => a.status === 'in_progress').length,
      completed: assignments.filter((a) => a.status === 'completed').length,
      skipped: assignments.filter((a) => a.status === 'skipped').length,
    };

    // Compute compliance if plan is active and has a lot
    let compliance = null;
    if (plan.isActive && plan.lotId) {
      compliance = await computeComplianceScore(
        app.db,
        plan.lotId,
        request.dealershipId,
      );
    }

    return reply.status(200).send({
      data: {
        ...plan,
        stats,
        compliance,
      },
    });
  });

  // ── PATCH /:id — update plan -----------------------------------------------

  app.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateStagingPlanSchema.parse(request.body);

    const [existing] = await app.db
      .select()
      .from(stagingPlans)
      .where(
        and(
          eq(stagingPlans.id, id),
          eq(stagingPlans.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('Staging plan not found');
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (body.name !== undefined) updates['name'] = body.name;
    if (body.rules !== undefined) updates['rules'] = JSON.stringify(body.rules);
    if (body.is_template !== undefined) updates['isTemplate'] = body.is_template;

    const [updated] = await app.db
      .update(stagingPlans)
      .set(updates)
      .where(eq(stagingPlans.id, id))
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.UPDATE,
      entityType: 'staging_plan',
      entityId: id,
      changes: body as Record<string, unknown>,
      ipAddress: request.ip,
    });

    return reply.status(200).send({ data: updated });
  });

  // ── DELETE /:id — delete plan (hard delete) --------------------------------

  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [existing] = await app.db
      .select({ id: stagingPlans.id })
      .from(stagingPlans)
      .where(
        and(
          eq(stagingPlans.id, id),
          eq(stagingPlans.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('Staging plan not found');
    }

    // Cascade will remove staging_assignments via FK
    await app.db
      .delete(stagingPlans)
      .where(eq(stagingPlans.id, id));

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.DELETE,
      entityType: 'staging_plan',
      entityId: id,
      ipAddress: request.ip,
    });

    return reply.status(200).send({ message: 'Staging plan deleted successfully' });
  });

  // ── POST /:id/activate — activate plan ------------------------------------

  app.post('/:id/activate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [plan] = await app.db
      .select()
      .from(stagingPlans)
      .where(
        and(
          eq(stagingPlans.id, id),
          eq(stagingPlans.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!plan) {
      throw notFound('Staging plan not found');
    }

    if (plan.isActive) {
      throw badRequest('Staging plan is already active');
    }

    if (!plan.lotId) {
      throw badRequest('Staging plan has no associated lot');
    }

    // Deactivate all other plans for the same lot
    await app.db
      .update(stagingPlans)
      .set({ isActive: false, updatedAt: new Date() })
      .where(
        and(
          eq(stagingPlans.lotId, plan.lotId),
          eq(stagingPlans.dealershipId, request.dealershipId),
          eq(stagingPlans.isActive, true),
        ),
      );

    // Activate this plan
    const [activated] = await app.db
      .update(stagingPlans)
      .set({
        isActive: true,
        activatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(stagingPlans.id, id))
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.STATUS_CHANGE,
      entityType: 'staging_plan',
      entityId: id,
      changes: { is_active: true },
      ipAddress: request.ip,
    });

    // Snapshot compliance for the lot
    await snapshotCompliance(app.db, plan.lotId, request.dealershipId);

    return reply.status(200).send({ data: activated });
  });

  // ── POST /:id/deactivate — deactivate plan --------------------------------

  app.post('/:id/deactivate', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [plan] = await app.db
      .select()
      .from(stagingPlans)
      .where(
        and(
          eq(stagingPlans.id, id),
          eq(stagingPlans.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!plan) {
      throw notFound('Staging plan not found');
    }

    if (!plan.isActive) {
      throw badRequest('Staging plan is already inactive');
    }

    const [deactivated] = await app.db
      .update(stagingPlans)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(stagingPlans.id, id))
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.STATUS_CHANGE,
      entityType: 'staging_plan',
      entityId: id,
      changes: { is_active: false },
      ipAddress: request.ip,
    });

    return reply.status(200).send({ data: deactivated });
  });

  // ── POST /:id/clone — clone plan ------------------------------------------

  app.post('/:id/clone', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = cloneBodySchema.parse(request.body ?? {});

    const [source] = await app.db
      .select()
      .from(stagingPlans)
      .where(
        and(
          eq(stagingPlans.id, id),
          eq(stagingPlans.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!source) {
      throw notFound('Staging plan not found');
    }

    const cloneName = body.name ?? `${source.name} (Copy)`;

    const [cloned] = await app.db
      .insert(stagingPlans)
      .values({
        lotId: source.lotId,
        dealershipId: request.dealershipId,
        name: cloneName,
        isTemplate: body.is_template ?? source.isTemplate,
        isActive: false,
        rules: source.rules,
      })
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.CREATE,
      entityType: 'staging_plan',
      entityId: cloned!.id,
      changes: { cloned_from: id },
      ipAddress: request.ip,
    });

    return reply.status(201).send({ data: cloned });
  });

  // ── GET /:id/move-list — compute move list ---------------------------------

  app.get('/:id/move-list', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [plan] = await app.db
      .select()
      .from(stagingPlans)
      .where(
        and(
          eq(stagingPlans.id, id),
          eq(stagingPlans.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!plan) {
      throw notFound('Staging plan not found');
    }

    if (!plan.lotId) {
      throw badRequest('Staging plan has no associated lot');
    }

    const rules = (plan.rules ?? []) as StagingRule[];

    const moves = await computeMoveList(
      app.db,
      plan.id,
      plan.lotId,
      request.dealershipId,
      rules,
    );

    // Upsert staging assignments for each move
    for (const move of moves) {
      // Check if an assignment already exists for this plan+unit
      const [existingAssignment] = await app.db
        .select({ id: stagingAssignments.id, status: stagingAssignments.status })
        .from(stagingAssignments)
        .where(
          and(
            eq(stagingAssignments.planId, id),
            eq(stagingAssignments.unitId, move.unitId),
          ),
        )
        .limit(1);

      if (!existingAssignment) {
        await app.db.insert(stagingAssignments).values({
          planId: id,
          unitId: move.unitId,
          targetRow: move.targetRow,
          targetSpot: move.targetSpot,
          priority: move.priority,
          status: 'pending',
        });
      } else if (existingAssignment.status === 'pending') {
        // Update target if it changed and assignment is still pending
        await app.db
          .update(stagingAssignments)
          .set({
            targetRow: move.targetRow,
            targetSpot: move.targetSpot,
            priority: move.priority,
          })
          .where(eq(stagingAssignments.id, existingAssignment.id));
      }
    }

    // Fetch the full assignment records to return with IDs
    const assignmentRecords = await app.db
      .select()
      .from(stagingAssignments)
      .where(eq(stagingAssignments.planId, id));

    // Build response with assignment IDs attached to moves
    const assignmentMap = new Map(
      assignmentRecords.map((a) => [a.unitId, a]),
    );

    const movesWithIds = moves.map((move) => {
      const assignment = assignmentMap.get(move.unitId);
      return {
        assignment_id: assignment?.id ?? null,
        status: assignment?.status ?? 'pending',
        ...move,
      };
    });

    return reply.status(200).send({
      data: movesWithIds,
      summary: {
        total_moves: moves.length,
        total_distance_m: Math.round(
          moves.reduce((sum, m) => sum + m.distanceM, 0) * 100,
        ) / 100,
      },
    });
  });

  // ── POST /:id/moves/:assignmentId/complete — mark move completed ----------

  app.post(
    '/:id/moves/:assignmentId/complete',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id, assignmentId } = request.params as {
        id: string;
        assignmentId: string;
      };

      // Verify plan exists and belongs to dealership
      const [plan] = await app.db
        .select({ id: stagingPlans.id })
        .from(stagingPlans)
        .where(
          and(
            eq(stagingPlans.id, id),
            eq(stagingPlans.dealershipId, request.dealershipId),
          ),
        )
        .limit(1);

      if (!plan) {
        throw notFound('Staging plan not found');
      }

      // Verify assignment exists and belongs to this plan
      const [assignment] = await app.db
        .select()
        .from(stagingAssignments)
        .where(
          and(
            eq(stagingAssignments.id, assignmentId),
            eq(stagingAssignments.planId, id),
          ),
        )
        .limit(1);

      if (!assignment) {
        throw notFound('Assignment not found');
      }

      if (assignment.status === 'completed') {
        throw badRequest('Assignment is already completed');
      }

      if (assignment.status === 'skipped') {
        throw badRequest('Assignment was skipped and cannot be completed');
      }

      const [updated] = await app.db
        .update(stagingAssignments)
        .set({
          status: 'completed',
          completedAt: new Date(),
        })
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

  // ── POST /:id/moves/:assignmentId/skip — skip a move ----------------------

  app.post(
    '/:id/moves/:assignmentId/skip',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id, assignmentId } = request.params as {
        id: string;
        assignmentId: string;
      };

      // Verify plan exists and belongs to dealership
      const [plan] = await app.db
        .select({ id: stagingPlans.id })
        .from(stagingPlans)
        .where(
          and(
            eq(stagingPlans.id, id),
            eq(stagingPlans.dealershipId, request.dealershipId),
          ),
        )
        .limit(1);

      if (!plan) {
        throw notFound('Staging plan not found');
      }

      // Verify assignment exists and belongs to this plan
      const [assignment] = await app.db
        .select()
        .from(stagingAssignments)
        .where(
          and(
            eq(stagingAssignments.id, assignmentId),
            eq(stagingAssignments.planId, id),
          ),
        )
        .limit(1);

      if (!assignment) {
        throw notFound('Assignment not found');
      }

      if (assignment.status === 'completed') {
        throw badRequest('Assignment is already completed and cannot be skipped');
      }

      if (assignment.status === 'skipped') {
        throw badRequest('Assignment is already skipped');
      }

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

  // ── GET /:id/compliance — get compliance score for the plan's lot ----------

  app.get('/:id/compliance', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [plan] = await app.db
      .select()
      .from(stagingPlans)
      .where(
        and(
          eq(stagingPlans.id, id),
          eq(stagingPlans.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!plan) {
      throw notFound('Staging plan not found');
    }

    if (!plan.lotId) {
      throw badRequest('Staging plan has no associated lot');
    }

    const score = await computeComplianceScore(
      app.db,
      plan.lotId,
      request.dealershipId,
    );

    // Take a snapshot for history
    await snapshotCompliance(app.db, plan.lotId, request.dealershipId);

    return reply.status(200).send({ data: score });
  });
}
