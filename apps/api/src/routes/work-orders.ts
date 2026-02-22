// ---------------------------------------------------------------------------
// RV Trax API — Work Order routes (CRUD + batch + pipeline + route)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, gt, count, inArray, isNull } from 'drizzle-orm';
import { workOrders, units, trackerAssignments, trackers } from '@rv-trax/db';
import {
  createWorkOrderSchema,
  batchCreateWorkOrdersSchema,
  paginationSchema,
  AuditAction,
  WorkOrderStatus,
  WorkOrderPriority,
} from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, badRequest } from '../utils/errors.js';
import { decodeCursor, buildPaginatedResponse } from '../utils/pagination.js';
import { logAction } from '../services/audit.js';
import { computeWalkingRoute } from '../services/route-optimizer.js';
import type { RoutePoint } from '../services/route-optimizer.js';
import { z } from 'zod';
import crypto from 'node:crypto';

// ── Local schemas -----------------------------------------------------------

const updateWorkOrderSchema = z.object({
  notes: z.string().optional(),
  priority: z
    .enum(
      Object.values(WorkOrderPriority) as [string, ...string[]],
    )
    .optional(),
  due_date: z.string().optional(),
  assigned_to: z.string().uuid().optional(),
});

const statusTransitionSchema = z.object({
  status: z.enum(
    Object.values(WorkOrderStatus) as [string, ...string[]],
  ),
});

// ── Valid status transitions ------------------------------------------------

const VALID_TRANSITIONS: Record<string, string[]> = {
  [WorkOrderStatus.PENDING]: [WorkOrderStatus.ASSIGNED, WorkOrderStatus.CANCELLED],
  [WorkOrderStatus.ASSIGNED]: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED],
  [WorkOrderStatus.IN_PROGRESS]: [
    WorkOrderStatus.BLOCKED,
    WorkOrderStatus.COMPLETE,
    WorkOrderStatus.CANCELLED,
  ],
  [WorkOrderStatus.BLOCKED]: [WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED],
  [WorkOrderStatus.COMPLETE]: [],
  [WorkOrderStatus.CANCELLED]: [],
};

export default async function workOrderRoutes(
  app: FastifyInstance,
): Promise<void> {
  // All routes require auth + tenant
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── POST / — create work order ---------------------------------------------

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createWorkOrderSchema.parse(request.body);

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

    const [wo] = await app.db
      .insert(workOrders)
      .values({
        dealershipId: request.dealershipId,
        unitId: body.unit_id,
        orderType: body.order_type,
        priority: body.priority,
        assignedTo: body.assigned_to ?? null,
        notes: body.notes ?? null,
        dueDate: body.due_date ?? null,
        status: body.assigned_to
          ? WorkOrderStatus.ASSIGNED
          : WorkOrderStatus.PENDING,
      })
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.CREATE,
      entityType: 'work_order',
      entityId: wo!.id,
      ipAddress: request.ip,
    });

    return reply.status(201).send({ data: wo });
  });

  // ── GET / — list work orders with filters ----------------------------------

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    const { limit, cursor } = paginationSchema.parse(query);

    const conditions = [eq(workOrders.dealershipId, request.dealershipId)];

    if (query['status']) {
      conditions.push(eq(workOrders.status, query['status']));
    }
    if (query['order_type']) {
      conditions.push(eq(workOrders.orderType, query['order_type']));
    }
    if (query['priority']) {
      conditions.push(eq(workOrders.priority, query['priority']));
    }
    if (query['assigned_to']) {
      conditions.push(eq(workOrders.assignedTo, query['assigned_to']));
    }
    if (query['unit_id']) {
      conditions.push(eq(workOrders.unitId, query['unit_id']));
    }
    if (query['batch_id']) {
      conditions.push(eq(workOrders.batchId, query['batch_id']));
    }

    if (cursor) {
      const decodedId = decodeCursor(cursor);
      conditions.push(gt(workOrders.id, decodedId));
    }

    const where = and(...conditions);

    // Get total count
    const [countResult] = await app.db
      .select({ value: count() })
      .from(workOrders)
      .where(where);

    const totalCount = countResult?.value ?? 0;

    const rows = await app.db
      .select({
        id: workOrders.id,
        dealershipId: workOrders.dealershipId,
        unitId: workOrders.unitId,
        batchId: workOrders.batchId,
        orderType: workOrders.orderType,
        priority: workOrders.priority,
        status: workOrders.status,
        assignedTo: workOrders.assignedTo,
        notes: workOrders.notes,
        dueDate: workOrders.dueDate,
        completedAt: workOrders.completedAt,
        createdAt: workOrders.createdAt,
        updatedAt: workOrders.updatedAt,
        stockNumber: units.stockNumber,
        make: units.make,
        model: units.model,
      })
      .from(workOrders)
      .leftJoin(units, eq(workOrders.unitId, units.id))
      .where(where)
      .orderBy(desc(workOrders.createdAt))
      .limit(limit + 1);

    return reply.status(200).send(buildPaginatedResponse(rows, limit, totalCount));
  });

  // ── GET /:id — single work order with unit info ----------------------------

  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [wo] = await app.db
      .select({
        id: workOrders.id,
        dealershipId: workOrders.dealershipId,
        unitId: workOrders.unitId,
        batchId: workOrders.batchId,
        orderType: workOrders.orderType,
        priority: workOrders.priority,
        status: workOrders.status,
        assignedTo: workOrders.assignedTo,
        notes: workOrders.notes,
        dueDate: workOrders.dueDate,
        completedAt: workOrders.completedAt,
        createdAt: workOrders.createdAt,
        updatedAt: workOrders.updatedAt,
        stockNumber: units.stockNumber,
        make: units.make,
        model: units.model,
        vin: units.vin,
        year: units.year,
        unitType: units.unitType,
      })
      .from(workOrders)
      .leftJoin(units, eq(workOrders.unitId, units.id))
      .where(
        and(
          eq(workOrders.id, id),
          eq(workOrders.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!wo) {
      throw notFound('Work order not found');
    }

    return reply.status(200).send({
      data: {
        ...wo,
        unit: {
          stock_number: wo.stockNumber,
          make: wo.make,
          model: wo.model,
          vin: wo.vin,
          year: wo.year,
          unit_type: wo.unitType,
        },
      },
    });
  });

  // ── PATCH /:id — update work order -----------------------------------------

  app.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateWorkOrderSchema.parse(request.body);

    // Verify work order exists and belongs to dealership
    const [existing] = await app.db
      .select()
      .from(workOrders)
      .where(
        and(
          eq(workOrders.id, id),
          eq(workOrders.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('Work order not found');
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.notes !== undefined) updates['notes'] = body.notes;
    if (body.priority !== undefined) updates['priority'] = body.priority;
    if (body.due_date !== undefined) updates['dueDate'] = body.due_date;
    if (body.assigned_to !== undefined) updates['assignedTo'] = body.assigned_to;

    const [updated] = await app.db
      .update(workOrders)
      .set(updates)
      .where(eq(workOrders.id, id))
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.UPDATE,
      entityType: 'work_order',
      entityId: id,
      changes: body as Record<string, unknown>,
      ipAddress: request.ip,
    });

    return reply.status(200).send({ data: updated });
  });

  // ── POST /:id/status — transition work order status ------------------------

  app.post(
    '/:id/status',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = statusTransitionSchema.parse(request.body);
      const newStatus = body.status;

      // Fetch existing work order
      const [existing] = await app.db
        .select()
        .from(workOrders)
        .where(
          and(
            eq(workOrders.id, id),
            eq(workOrders.dealershipId, request.dealershipId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw notFound('Work order not found');
      }

      // Validate transition
      const allowedTransitions = VALID_TRANSITIONS[existing.status];
      if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
        throw badRequest(
          `Cannot transition from '${existing.status}' to '${newStatus}'`,
        );
      }

      // If assigning, require that assigned_to exists on the record
      if (
        newStatus === WorkOrderStatus.ASSIGNED &&
        !existing.assignedTo
      ) {
        throw badRequest(
          'Cannot transition to assigned — no assigned_to user on this work order',
        );
      }

      const updates: Record<string, unknown> = {
        status: newStatus,
        updatedAt: new Date(),
      };

      // If completing, set completedAt
      if (newStatus === WorkOrderStatus.COMPLETE) {
        updates['completedAt'] = new Date();
      }

      const [updated] = await app.db
        .update(workOrders)
        .set(updates)
        .where(eq(workOrders.id, id))
        .returning();

      await logAction(app.db, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: AuditAction.STATUS_CHANGE,
        entityType: 'work_order',
        entityId: id,
        changes: {
          from: existing.status,
          to: newStatus,
        },
        ipAddress: request.ip,
      });

      return reply.status(200).send({ data: updated });
    },
  );

  // ── POST /batch — batch create work orders ---------------------------------

  app.post('/batch', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = batchCreateWorkOrdersSchema.parse(request.body);
    const batchId = crypto.randomUUID();

    // Verify all units exist and belong to dealership
    const existingUnits = await app.db
      .select({ id: units.id })
      .from(units)
      .where(
        and(
          inArray(units.id, body.unit_ids),
          eq(units.dealershipId, request.dealershipId),
        ),
      );

    const existingUnitIds = new Set(existingUnits.map((u) => u.id));
    const missingIds = body.unit_ids.filter((uid) => !existingUnitIds.has(uid));

    if (missingIds.length > 0) {
      throw badRequest(
        `Units not found or not in your dealership: ${missingIds.join(', ')}`,
      );
    }

    // Insert all work orders with the same batchId
    const valuesToInsert = body.unit_ids.map((unitId) => ({
      dealershipId: request.dealershipId,
      unitId,
      batchId,
      orderType: body.order_type,
      priority: body.priority,
      assignedTo: body.assigned_to ?? null,
      notes: body.notes ?? null,
      dueDate: body.due_date ?? null,
      status: body.assigned_to
        ? WorkOrderStatus.ASSIGNED
        : WorkOrderStatus.PENDING,
    }));

    await app.db.insert(workOrders).values(valuesToInsert);

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.CREATE,
      entityType: 'work_order_batch',
      entityId: batchId,
      changes: {
        batch_size: body.unit_ids.length,
        order_type: body.order_type,
      },
      ipAddress: request.ip,
    });

    return reply.status(201).send({
      data: {
        batch_id: batchId,
        created_count: body.unit_ids.length,
      },
    });
  });

  // ── GET /batch/:batchId — list work orders in batch ------------------------

  app.get(
    '/batch/:batchId',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { batchId } = request.params as { batchId: string };

      const rows = await app.db
        .select({
          id: workOrders.id,
          dealershipId: workOrders.dealershipId,
          unitId: workOrders.unitId,
          batchId: workOrders.batchId,
          orderType: workOrders.orderType,
          priority: workOrders.priority,
          status: workOrders.status,
          assignedTo: workOrders.assignedTo,
          notes: workOrders.notes,
          dueDate: workOrders.dueDate,
          completedAt: workOrders.completedAt,
          createdAt: workOrders.createdAt,
          updatedAt: workOrders.updatedAt,
          stockNumber: units.stockNumber,
          make: units.make,
          model: units.model,
        })
        .from(workOrders)
        .leftJoin(units, eq(workOrders.unitId, units.id))
        .where(
          and(
            eq(workOrders.batchId, batchId),
            eq(workOrders.dealershipId, request.dealershipId),
          ),
        )
        .orderBy(desc(workOrders.createdAt));

      return reply.status(200).send({ data: rows });
    },
  );

  // ── GET /batch/:batchId/route — optimized walking route for batch ----------

  app.get(
    '/batch/:batchId/route',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { batchId } = request.params as { batchId: string };

      // Fetch work orders in batch with unit positions via tracker assignments.
      // Units get their position from the tracker's last known lat/lng.
      const rows = await app.db
        .select({
          woId: workOrders.id,
          unitId: workOrders.unitId,
          stockNumber: units.stockNumber,
          lastLatitude: trackers.lastLatitude,
          lastLongitude: trackers.lastLongitude,
        })
        .from(workOrders)
        .innerJoin(units, eq(workOrders.unitId, units.id))
        .leftJoin(
          trackerAssignments,
          and(
            eq(trackerAssignments.unitId, units.id),
            isNull(trackerAssignments.unassignedAt),
          ),
        )
        .leftJoin(trackers, eq(trackers.id, trackerAssignments.trackerId))
        .where(
          and(
            eq(workOrders.batchId, batchId),
            eq(workOrders.dealershipId, request.dealershipId),
          ),
        );

      if (rows.length === 0) {
        throw notFound('No work orders found for this batch');
      }

      // Filter to units with valid tracker positions
      const routePoints: RoutePoint[] = [];
      for (const row of rows) {
        if (
          row.lastLatitude &&
          row.lastLongitude &&
          row.unitId &&
          row.stockNumber
        ) {
          routePoints.push({
            id: row.woId,
            unitId: row.unitId,
            stockNumber: row.stockNumber,
            lat: parseFloat(row.lastLatitude),
            lng: parseFloat(row.lastLongitude),
          });
        }
      }

      if (routePoints.length === 0) {
        throw badRequest(
          'No units in this batch have location data for route optimization',
        );
      }

      const route = computeWalkingRoute(routePoints);

      return reply.status(200).send({ data: route });
    },
  );

  // ── GET /pipeline — kanban/pipeline data -----------------------------------

  app.get(
    '/pipeline',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const allStatuses = Object.values(WorkOrderStatus);

      const rows = await app.db
        .select({
          id: workOrders.id,
          dealershipId: workOrders.dealershipId,
          unitId: workOrders.unitId,
          batchId: workOrders.batchId,
          orderType: workOrders.orderType,
          priority: workOrders.priority,
          status: workOrders.status,
          assignedTo: workOrders.assignedTo,
          notes: workOrders.notes,
          dueDate: workOrders.dueDate,
          completedAt: workOrders.completedAt,
          createdAt: workOrders.createdAt,
          updatedAt: workOrders.updatedAt,
          stockNumber: units.stockNumber,
          make: units.make,
          model: units.model,
        })
        .from(workOrders)
        .leftJoin(units, eq(workOrders.unitId, units.id))
        .where(eq(workOrders.dealershipId, request.dealershipId))
        .orderBy(desc(workOrders.createdAt));

      // Group by status
      const pipeline: Record<string, typeof rows> = {};
      for (const status of allStatuses) {
        pipeline[status] = [];
      }
      for (const row of rows) {
        const bucket = pipeline[row.status];
        if (bucket) {
          bucket.push(row);
        }
      }

      return reply.status(200).send({ data: pipeline });
    },
  );
}
