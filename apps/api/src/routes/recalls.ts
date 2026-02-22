// ---------------------------------------------------------------------------
// RV Trax API — Recall routes (CRUD + matching + batch work order creation)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, or, gte, lte, ilike, desc, gt, count } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';
import { recalls, units, workOrders } from '@rv-trax/db';
import type { Database } from '@rv-trax/db';
import {
  createRecallSchema,
  paginationSchema,
  AuditAction,
  RecallStatus,
  WorkOrderStatus,
  WorkOrderType,
} from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, badRequest } from '../utils/errors.js';
import { decodeCursor, buildPaginatedResponse } from '../utils/pagination.js';
import { logAction } from '../services/audit.js';
import { z } from 'zod';
import crypto from 'node:crypto';

// ── Local schemas -----------------------------------------------------------

const updateRecallSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  affected_vins: z.string().optional(),
  affected_makes: z.array(z.string().min(1)).optional(),
  affected_models: z.array(z.string().min(1)).optional(),
  affected_year_start: z.number().int().min(1900).max(2100).optional(),
  affected_year_end: z.number().int().min(1900).max(2100).optional(),
  status: z
    .enum(Object.values(RecallStatus) as [string, ...string[]])
    .optional(),
});

// ── Recall criteria shape ---------------------------------------------------

interface RecallCriteria {
  affectedVins: string | null;
  affectedMakes: string | null;
  affectedModels: string | null;
  affectedYearStart: number | null;
  affectedYearEnd: number | null;
}

// ── Helpers -----------------------------------------------------------------

/**
 * Build SQL conditions to match units against a recall's criteria within a
 * dealership. The criteria use OR logic between VINs, makes, and models
 * (any match qualifies) but AND logic for year range.
 */
function buildMatchConditions(
  dealershipId: string,
  recall: RecallCriteria,
): SQL | undefined {
  const topLevel: SQL[] = [eq(units.dealershipId, dealershipId)];

  // Build OR conditions for VINs, makes, models
  const matchOr: SQL[] = [];

  // VIN matching — each entry can be a prefix or exact VIN
  if (recall.affectedVins) {
    const vins = recall.affectedVins
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const vin of vins) {
      matchOr.push(ilike(units.vin, `${vin}%`));
    }
  }

  // Make matching
  if (recall.affectedMakes) {
    const makes = recall.affectedMakes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const make of makes) {
      matchOr.push(ilike(units.make, make));
    }
  }

  // Model matching
  if (recall.affectedModels) {
    const models = recall.affectedModels
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const model of models) {
      matchOr.push(ilike(units.model, model));
    }
  }

  // At least one OR condition is required for a valid match
  if (matchOr.length === 0) {
    return undefined;
  }

  topLevel.push(or(...matchOr)!);

  // Year range (AND with the rest)
  if (recall.affectedYearStart !== null) {
    topLevel.push(gte(units.year, recall.affectedYearStart));
  }
  if (recall.affectedYearEnd !== null) {
    topLevel.push(lte(units.year, recall.affectedYearEnd));
  }

  return and(...topLevel);
}

/**
 * Find all units matching a recall's criteria within a dealership.
 */
async function findMatchedUnits(
  db: Database,
  dealershipId: string,
  recall: RecallCriteria,
) {
  const where = buildMatchConditions(dealershipId, recall);
  if (!where) return [];

  return db.select().from(units).where(where);
}

export default async function recallRoutes(
  app: FastifyInstance,
): Promise<void> {
  // All routes require auth + tenant
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── POST / — create recall -------------------------------------------------

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createRecallSchema.parse(request.body);

    const [recall] = await app.db
      .insert(recalls)
      .values({
        dealershipId: request.dealershipId,
        title: body.title,
        description: body.description ?? null,
        affectedVins: body.affected_vins ?? null,
        affectedMakes:
          body.affected_makes.length > 0
            ? body.affected_makes.join(',')
            : null,
        affectedModels:
          body.affected_models.length > 0
            ? body.affected_models.join(',')
            : null,
        affectedYearStart: body.affected_year_start ?? null,
        affectedYearEnd: body.affected_year_end ?? null,
        status: RecallStatus.OPEN,
      })
      .returning();

    const createdRecall = recall!;

    // Auto-run matching to get initial count
    const matched = await findMatchedUnits(
      app.db,
      request.dealershipId,
      createdRecall,
    );

    await app.db
      .update(recalls)
      .set({ matchedUnitCount: matched.length, updatedAt: new Date() })
      .where(eq(recalls.id, createdRecall.id));

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.CREATE,
      entityType: 'recall',
      entityId: createdRecall.id,
      ipAddress: request.ip,
    });

    return reply.status(201).send({
      data: {
        ...createdRecall,
        matchedUnitCount: matched.length,
      },
    });
  });

  // ── GET / — list recalls ---------------------------------------------------

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    const { limit, cursor } = paginationSchema.parse(query);

    const conditions: SQL[] = [eq(recalls.dealershipId, request.dealershipId)];

    if (query['status']) {
      conditions.push(eq(recalls.status, query['status']));
    }

    if (cursor) {
      const decodedId = decodeCursor(cursor);
      conditions.push(gt(recalls.id, decodedId));
    }

    const where = and(...conditions);

    const [countResult] = await app.db
      .select({ value: count() })
      .from(recalls)
      .where(where);

    const totalCount = countResult?.value ?? 0;

    const rows = await app.db
      .select()
      .from(recalls)
      .where(where)
      .orderBy(desc(recalls.createdAt))
      .limit(limit + 1);

    return reply
      .status(200)
      .send(buildPaginatedResponse(rows, limit, totalCount));
  });

  // ── GET /:id — recall detail with matched units ----------------------------

  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [recall] = await app.db
      .select()
      .from(recalls)
      .where(
        and(
          eq(recalls.id, id),
          eq(recalls.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!recall) {
      throw notFound('Recall not found');
    }

    // Find matched units
    const matched = await findMatchedUnits(
      app.db,
      request.dealershipId,
      recall,
    );

    return reply.status(200).send({
      data: {
        ...recall,
        matched_units: matched,
      },
    });
  });

  // ── PATCH /:id — update recall ---------------------------------------------

  app.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateRecallSchema.parse(request.body);

    const [existing] = await app.db
      .select()
      .from(recalls)
      .where(
        and(
          eq(recalls.id, id),
          eq(recalls.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('Recall not found');
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.title !== undefined) updates['title'] = body.title;
    if (body.description !== undefined) updates['description'] = body.description;
    if (body.affected_vins !== undefined) updates['affectedVins'] = body.affected_vins;
    if (body.affected_makes !== undefined) {
      updates['affectedMakes'] = body.affected_makes.join(',');
    }
    if (body.affected_models !== undefined) {
      updates['affectedModels'] = body.affected_models.join(',');
    }
    if (body.affected_year_start !== undefined) {
      updates['affectedYearStart'] = body.affected_year_start;
    }
    if (body.affected_year_end !== undefined) {
      updates['affectedYearEnd'] = body.affected_year_end;
    }
    if (body.status !== undefined) updates['status'] = body.status;

    const [updated] = await app.db
      .update(recalls)
      .set(updates)
      .where(eq(recalls.id, id))
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.UPDATE,
      entityType: 'recall',
      entityId: id,
      changes: body as Record<string, unknown>,
      ipAddress: request.ip,
    });

    return reply.status(200).send({ data: updated });
  });

  // ── POST /:id/match — run matching algorithm -------------------------------

  app.post(
    '/:id/match',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const [recall] = await app.db
        .select()
        .from(recalls)
        .where(
          and(
            eq(recalls.id, id),
            eq(recalls.dealershipId, request.dealershipId),
          ),
        )
        .limit(1);

      if (!recall) {
        throw notFound('Recall not found');
      }

      const matched = await findMatchedUnits(
        app.db,
        request.dealershipId,
        recall,
      );

      await app.db
        .update(recalls)
        .set({ matchedUnitCount: matched.length, updatedAt: new Date() })
        .where(eq(recalls.id, id));

      return reply.status(200).send({
        data: {
          matched_unit_count: matched.length,
          matched_unit_ids: matched.map((u) => u.id),
        },
      });
    },
  );

  // ── POST /:id/create-work-orders — batch WOs for matched units -------------

  app.post(
    '/:id/create-work-orders',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const [recall] = await app.db
        .select()
        .from(recalls)
        .where(
          and(
            eq(recalls.id, id),
            eq(recalls.dealershipId, request.dealershipId),
          ),
        )
        .limit(1);

      if (!recall) {
        throw notFound('Recall not found');
      }

      if (recall.status === RecallStatus.CLOSED) {
        throw badRequest('Cannot create work orders for a closed recall');
      }

      const matched = await findMatchedUnits(
        app.db,
        request.dealershipId,
        recall,
      );

      if (matched.length === 0) {
        throw badRequest('No matching units found for this recall');
      }

      const batchId = crypto.randomUUID();

      // Create work orders for all matched units
      const valuesToInsert = matched.map((unit) => ({
        dealershipId: request.dealershipId,
        unitId: unit.id,
        batchId,
        orderType: WorkOrderType.RECALL,
        priority: 'normal' as const,
        status: WorkOrderStatus.PENDING,
        notes: `Recall: ${recall.title}`,
      }));

      // Insert work orders, update recall, and audit in a single transaction
      await app.db.transaction(async (tx) => {
        await tx.insert(workOrders).values(valuesToInsert);

        await tx
          .update(recalls)
          .set({
            batchId,
            status: RecallStatus.IN_PROGRESS,
            matchedUnitCount: matched.length,
            updatedAt: new Date(),
          })
          .where(eq(recalls.id, id));

        await logAction(tx, {
          dealershipId: request.dealershipId,
          userId: request.user.sub,
          action: AuditAction.CREATE,
          entityType: 'recall_work_orders',
          entityId: id,
          changes: {
            batch_id: batchId,
            work_order_count: matched.length,
          },
          ipAddress: request.ip,
        });
      });

      return reply.status(201).send({
        data: {
          recall_id: id,
          batch_id: batchId,
          work_orders_created: matched.length,
        },
      });
    },
  );
}
