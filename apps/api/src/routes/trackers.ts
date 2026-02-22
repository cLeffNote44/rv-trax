// ---------------------------------------------------------------------------
// RV Trax API — Tracker routes (GET/POST /api/v1/trackers)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, isNull, count, gt } from 'drizzle-orm';
import { trackers, trackerAssignments, units } from '@rv-trax/db';
import { createTrackerSchema, assignTrackerSchema, paginationSchema } from '@rv-trax/shared';
import { AuditAction, TrackerStatus } from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, conflict, badRequest } from '../utils/errors.js';
import { decodeCursor, buildPaginatedResponse } from '../utils/pagination.js';
import { logAction } from '../services/audit.js';

export default async function trackerRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth + tenant
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── POST / — register tracker ----------------------------------------------

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createTrackerSchema.parse(request.body);

    // Check if device_eui already registered for this dealership
    const existing = await app.db
      .select({ id: trackers.id })
      .from(trackers)
      .where(
        and(
          eq(trackers.dealershipId, request.dealershipId),
          eq(trackers.deviceEui, body.device_eui),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw conflict(`Tracker with device EUI "${body.device_eui}" already exists`);
    }

    const [tracker] = await app.db
      .insert(trackers)
      .values({
        dealershipId: request.dealershipId,
        deviceEui: body.device_eui,
        label: body.label ?? null,
        firmwareVersion: body.firmware_version ?? null,
        status: TrackerStatus.UNASSIGNED,
      })
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.CREATE,
      entityType: 'tracker',
      entityId: tracker!.id,
      ipAddress: request.ip,
    });

    return reply.status(201).send({ data: tracker });
  });

  // ── GET / — list trackers --------------------------------------------------

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    const { limit, cursor } = paginationSchema.parse(query);

    const conditions = [eq(trackers.dealershipId, request.dealershipId)];

    if (query['status']) {
      conditions.push(eq(trackers.status, query['status']));
    }

    if (cursor) {
      const decodedId = decodeCursor(cursor);
      conditions.push(gt(trackers.id, decodedId));
    }

    const where = and(...conditions);

    const [countResult] = await app.db
      .select({ value: count() })
      .from(trackers)
      .where(where);

    const totalCount = countResult?.value ?? 0;

    const rows = await app.db
      .select()
      .from(trackers)
      .where(where)
      .orderBy(trackers.createdAt)
      .limit(limit + 1);

    return reply.status(200).send(buildPaginatedResponse(rows, limit, totalCount));
  });

  // ── GET /:id — tracker details with assigned unit --------------------------

  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [tracker] = await app.db
      .select()
      .from(trackers)
      .where(
        and(
          eq(trackers.id, id),
          eq(trackers.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!tracker) {
      throw notFound('Tracker not found');
    }

    // Fetch active assignment with unit info
    const activeAssignment = await app.db
      .select({
        assignment_id: trackerAssignments.id,
        unit_id: trackerAssignments.unitId,
        assigned_at: trackerAssignments.assignedAt,
        stock_number: units.stockNumber,
        vin: units.vin,
        year: units.year,
        make: units.make,
        model: units.model,
      })
      .from(trackerAssignments)
      .innerJoin(units, eq(units.id, trackerAssignments.unitId))
      .where(
        and(
          eq(trackerAssignments.trackerId, id),
          isNull(trackerAssignments.unassignedAt),
        ),
      )
      .limit(1);

    return reply.status(200).send({
      data: {
        ...tracker,
        assigned_unit: activeAssignment[0] ?? null,
      },
    });
  });

  // ── POST /:id/assign — assign to unit -------------------------------------

  app.post('/:id/assign', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = assignTrackerSchema.parse(request.body);

    // Verify tracker exists and belongs to dealership
    const [tracker] = await app.db
      .select()
      .from(trackers)
      .where(
        and(
          eq(trackers.id, id),
          eq(trackers.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!tracker) {
      throw notFound('Tracker not found');
    }

    if (tracker.status === TrackerStatus.RETIRED) {
      throw badRequest('Cannot assign a retired tracker');
    }

    // Check tracker not already assigned
    const existingTrackerAssignment = await app.db
      .select({ id: trackerAssignments.id })
      .from(trackerAssignments)
      .where(
        and(
          eq(trackerAssignments.trackerId, id),
          isNull(trackerAssignments.unassignedAt),
        ),
      )
      .limit(1);

    if (existingTrackerAssignment.length > 0) {
      throw conflict('Tracker is already assigned to a unit');
    }

    // Verify unit exists and belongs to dealership
    const [unit] = await app.db
      .select({ id: units.id })
      .from(units)
      .where(
        and(
          eq(units.id, body.unit_id),
          eq(units.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!unit) {
      throw notFound('Unit not found');
    }

    // Check unit doesn't already have an active tracker
    const existingUnitAssignment = await app.db
      .select({ id: trackerAssignments.id })
      .from(trackerAssignments)
      .where(
        and(
          eq(trackerAssignments.unitId, body.unit_id),
          isNull(trackerAssignments.unassignedAt),
        ),
      )
      .limit(1);

    if (existingUnitAssignment.length > 0) {
      throw conflict('Unit already has an active tracker assigned');
    }

    // Create assignment, update status, and audit in a single transaction
    const assignment = await app.db.transaction(async (tx) => {
      const [asgn] = await tx
        .insert(trackerAssignments)
        .values({
          trackerId: id,
          unitId: body.unit_id,
          assignedBy: request.user.sub,
        })
        .returning();

      await tx
        .update(trackers)
        .set({ status: TrackerStatus.ASSIGNED, updatedAt: new Date() })
        .where(eq(trackers.id, id));

      await logAction(tx, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: AuditAction.ASSIGN,
        entityType: 'tracker',
        entityId: id,
        changes: { unit_id: body.unit_id },
        ipAddress: request.ip,
      });

      return asgn;
    });

    return reply.status(201).send({ data: assignment });
  });

  // ── POST /:id/unassign — unassign from unit --------------------------------

  app.post('/:id/unassign', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    // Verify tracker exists and belongs to dealership
    const [tracker] = await app.db
      .select()
      .from(trackers)
      .where(
        and(
          eq(trackers.id, id),
          eq(trackers.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!tracker) {
      throw notFound('Tracker not found');
    }

    // Find active assignment
    const [assignment] = await app.db
      .select()
      .from(trackerAssignments)
      .where(
        and(
          eq(trackerAssignments.trackerId, id),
          isNull(trackerAssignments.unassignedAt),
        ),
      )
      .limit(1);

    if (!assignment) {
      throw badRequest('Tracker is not currently assigned');
    }

    // Unassign, update status, and audit in a single transaction
    await app.db.transaction(async (tx) => {
      await tx
        .update(trackerAssignments)
        .set({ unassignedAt: new Date() })
        .where(eq(trackerAssignments.id, assignment.id));

      await tx
        .update(trackers)
        .set({ status: TrackerStatus.UNASSIGNED, updatedAt: new Date() })
        .where(eq(trackers.id, id));

      await logAction(tx, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: AuditAction.UNASSIGN,
        entityType: 'tracker',
        entityId: id,
        changes: { unit_id: assignment.unitId },
        ipAddress: request.ip,
      });
    });

    return reply.status(200).send({ message: 'Tracker unassigned successfully' });
  });

  // ── POST /:id/retire — retire tracker --------------------------------------

  app.post('/:id/retire', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { reason } = (request.body as { reason?: string }) ?? {};

    // Verify tracker exists and belongs to dealership
    const [tracker] = await app.db
      .select()
      .from(trackers)
      .where(
        and(
          eq(trackers.id, id),
          eq(trackers.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!tracker) {
      throw notFound('Tracker not found');
    }

    if (tracker.status === TrackerStatus.RETIRED) {
      throw badRequest('Tracker is already retired');
    }

    // Unassign if currently assigned
    const [activeAssignment] = await app.db
      .select()
      .from(trackerAssignments)
      .where(
        and(
          eq(trackerAssignments.trackerId, id),
          isNull(trackerAssignments.unassignedAt),
        ),
      )
      .limit(1);

    // Unassign (if needed), retire, and audit in a single transaction
    await app.db.transaction(async (tx) => {
      if (activeAssignment) {
        await tx
          .update(trackerAssignments)
          .set({ unassignedAt: new Date() })
          .where(eq(trackerAssignments.id, activeAssignment.id));
      }

      await tx
        .update(trackers)
        .set({
          status: TrackerStatus.RETIRED,
          retiredAt: new Date(),
          retiredReason: reason ?? null,
          updatedAt: new Date(),
        })
        .where(eq(trackers.id, id));

      await logAction(tx, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: AuditAction.STATUS_CHANGE,
        entityType: 'tracker',
        entityId: id,
        changes: { status: TrackerStatus.RETIRED, reason: reason ?? null },
        ipAddress: request.ip,
      });
    });

    return reply.status(200).send({ message: 'Tracker retired successfully' });
  });
}
