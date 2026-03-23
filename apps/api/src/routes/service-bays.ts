// ---------------------------------------------------------------------------
// RV Trax API — Service Bay routes
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, isNull, sql, count, avg } from 'drizzle-orm';
import { serviceBays, serviceBayAssignments, units } from '@rv-trax/db';
import { ServiceBayStatus, ServiceStage } from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, badRequest } from '../utils/errors.js';
import { logAction } from '../services/audit.js';
import { z } from 'zod';

const createBaySchema = z.object({
  name: z.string().min(1),
  bay_type: z.string().default('general'),
  lot_id: z.string().uuid().optional(),
});

const checkInSchema = z.object({
  unit_id: z.string().uuid(),
  work_order_id: z.string().uuid().optional(),
  technician_id: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const VALID_STAGE_TRANSITIONS: Record<string, string[]> = {
  [ServiceStage.CHECKED_IN]: [ServiceStage.DIAGNOSIS],
  [ServiceStage.DIAGNOSIS]: [ServiceStage.IN_REPAIR, ServiceStage.READY],
  [ServiceStage.IN_REPAIR]: [ServiceStage.QUALITY_CHECK, ServiceStage.READY],
  [ServiceStage.QUALITY_CHECK]: [ServiceStage.READY, ServiceStage.IN_REPAIR],
  [ServiceStage.READY]: [],
};

export default async function serviceBayRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── GET / — list bays with current assignments -----------------------------

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const bays = await app.db
      .select()
      .from(serviceBays)
      .where(eq(serviceBays.dealershipId, request.dealershipId))
      .orderBy(serviceBays.name);

    // Get active assignments for each bay
    const assignments = await app.db
      .select({
        assignment: serviceBayAssignments,
        stockNumber: units.stockNumber,
        year: units.year,
        make: units.make,
        model: units.model,
      })
      .from(serviceBayAssignments)
      .innerJoin(units, eq(serviceBayAssignments.unitId, units.id))
      .where(isNull(serviceBayAssignments.checkedOutAt));

    const assignmentMap = new Map<string, typeof assignments>();
    for (const a of assignments) {
      const bayAssignments = assignmentMap.get(a.assignment.bayId) ?? [];
      bayAssignments.push(a);
      assignmentMap.set(a.assignment.bayId, bayAssignments);
    }

    const result = bays.map((bay) => ({
      ...bay,
      current_assignment: assignmentMap.get(bay.id)?.[0] ?? null,
    }));

    return reply.send({ data: result });
  });

  // ── POST / — create bay ----------------------------------------------------

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createBaySchema.parse(request.body);

    const [bay] = await app.db
      .insert(serviceBays)
      .values({
        dealershipId: request.dealershipId,
        name: body.name,
        bayType: body.bay_type,
        lotId: body.lot_id ?? null,
      })
      .returning();

    return reply.status(201).send({ data: bay });
  });

  // ── PATCH /:id — update bay ------------------------------------------------

  app.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Record<string, unknown>;

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name) updates.name = body.name;
    if (body.bay_type) updates.bayType = body.bay_type;
    if (body.status) updates.status = body.status;

    const [updated] = await app.db
      .update(serviceBays)
      .set(updates)
      .where(and(eq(serviceBays.id, id), eq(serviceBays.dealershipId, request.dealershipId)))
      .returning();

    if (!updated) throw notFound('Bay not found');
    return reply.send({ data: updated });
  });

  // ── DELETE /:id — delete bay -----------------------------------------------

  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [bay] = await app.db
      .select()
      .from(serviceBays)
      .where(and(eq(serviceBays.id, id), eq(serviceBays.dealershipId, request.dealershipId)))
      .limit(1);

    if (!bay) throw notFound('Bay not found');
    if (bay.status === ServiceBayStatus.OCCUPIED) {
      throw badRequest('Cannot delete an occupied bay');
    }

    await app.db.delete(serviceBays).where(eq(serviceBays.id, id));
    return reply.status(204).send();
  });

  // ── POST /:id/check-in — assign unit to bay --------------------------------

  app.post('/:id/check-in', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = checkInSchema.parse(request.body);

    const [bay] = await app.db
      .select()
      .from(serviceBays)
      .where(and(eq(serviceBays.id, id), eq(serviceBays.dealershipId, request.dealershipId)))
      .limit(1);

    if (!bay) throw notFound('Bay not found');
    if (bay.status === ServiceBayStatus.OCCUPIED) {
      throw badRequest('Bay is already occupied');
    }

    const result = await app.db.transaction(async (tx) => {
      const [assignment] = await tx
        .insert(serviceBayAssignments)
        .values({
          bayId: id,
          unitId: body.unit_id,
          workOrderId: body.work_order_id ?? null,
          technicianId: body.technician_id ?? null,
          assignedBy: request.user.sub,
          stage: ServiceStage.CHECKED_IN,
          notes: body.notes ?? null,
        })
        .returning();

      await tx
        .update(serviceBays)
        .set({ status: ServiceBayStatus.OCCUPIED, updatedAt: new Date() })
        .where(eq(serviceBays.id, id));

      return assignment;
    });

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: 'create',
      entityType: 'service_bay_assignment',
      entityId: result!.id,
      ipAddress: request.ip,
    });

    return reply.status(201).send({ data: result });
  });

  // ── PATCH /:id/stage — advance stage ---------------------------------------

  app.patch('/:id/stage', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { stage } = request.body as { stage: string };

    // Get current active assignment
    const [assignment] = await app.db
      .select()
      .from(serviceBayAssignments)
      .innerJoin(serviceBays, eq(serviceBayAssignments.bayId, serviceBays.id))
      .where(
        and(
          eq(serviceBayAssignments.bayId, id),
          isNull(serviceBayAssignments.checkedOutAt),
          eq(serviceBays.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!assignment) throw notFound('No active assignment in this bay');

    const current = assignment.service_bay_assignments.stage;
    const allowed = VALID_STAGE_TRANSITIONS[current] ?? [];
    if (!allowed.includes(stage)) {
      throw badRequest(
        `Cannot transition from ${current} to ${stage}. Allowed: ${allowed.join(', ')}`,
      );
    }

    const [updated] = await app.db
      .update(serviceBayAssignments)
      .set({ stage, stageChangedAt: new Date() })
      .where(eq(serviceBayAssignments.id, assignment.service_bay_assignments.id))
      .returning();

    return reply.send({ data: updated });
  });

  // ── POST /:id/check-out — release bay --------------------------------------

  app.post('/:id/check-out', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [assignment] = await app.db
      .select()
      .from(serviceBayAssignments)
      .innerJoin(serviceBays, eq(serviceBayAssignments.bayId, serviceBays.id))
      .where(
        and(
          eq(serviceBayAssignments.bayId, id),
          isNull(serviceBayAssignments.checkedOutAt),
          eq(serviceBays.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!assignment) throw notFound('No active assignment in this bay');

    const checkedIn = new Date(assignment.service_bay_assignments.checkedInAt);
    const now = new Date();
    const totalMinutes = Math.round((now.getTime() - checkedIn.getTime()) / (1000 * 60));

    const result = await app.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(serviceBayAssignments)
        .set({
          checkedOutAt: now,
          totalMinutes,
        })
        .where(eq(serviceBayAssignments.id, assignment.service_bay_assignments.id))
        .returning();

      await tx
        .update(serviceBays)
        .set({ status: ServiceBayStatus.AVAILABLE, updatedAt: now })
        .where(eq(serviceBays.id, id));

      return updated;
    });

    return reply.send({ data: result });
  });

  // ── GET /metrics — bay utilization and throughput ---------------------------

  app.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    const bays = await app.db
      .select()
      .from(serviceBays)
      .where(eq(serviceBays.dealershipId, request.dealershipId));

    const totalBays = bays.length;
    const occupied = bays.filter((b) => b.status === ServiceBayStatus.OCCUPIED).length;

    // Average time-in-bay for completed assignments (last 30 days)
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [avgResult] = await app.db
      .select({ avgMinutes: avg(serviceBayAssignments.totalMinutes) })
      .from(serviceBayAssignments)
      .innerJoin(serviceBays, eq(serviceBayAssignments.bayId, serviceBays.id))
      .where(
        and(
          eq(serviceBays.dealershipId, request.dealershipId),
          sql`${serviceBayAssignments.checkedOutAt} >= ${since.toISOString()}`,
        ),
      );

    // Completed assignments this week
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const [throughput] = await app.db
      .select({ completed: count(serviceBayAssignments.id) })
      .from(serviceBayAssignments)
      .innerJoin(serviceBays, eq(serviceBayAssignments.bayId, serviceBays.id))
      .where(
        and(
          eq(serviceBays.dealershipId, request.dealershipId),
          sql`${serviceBayAssignments.checkedOutAt} >= ${weekStart.toISOString()}`,
        ),
      );

    return reply.send({
      data: {
        total_bays: totalBays,
        occupied,
        available: totalBays - occupied,
        utilization_pct: totalBays > 0 ? Math.round((occupied / totalBays) * 100) : 0,
        avg_time_minutes: Math.round(Number(avgResult?.avgMinutes ?? 0)),
        completed_this_week: throughput?.completed ?? 0,
      },
    });
  });
}
