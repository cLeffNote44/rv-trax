// ---------------------------------------------------------------------------
// RV Trax API — Floor Plan Audit routes
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, isNull, count } from 'drizzle-orm';
import { floorPlanAudits, floorPlanAuditItems, units } from '@rv-trax/db';
import { paginationSchema, FloorPlanAuditStatus, AuditItemStatus } from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, badRequest } from '../utils/errors.js';
import { decodeCursor, buildPaginatedResponse } from '../utils/pagination.js';
import { logAction } from '../services/audit.js';
import { z } from 'zod';

const startAuditSchema = z.object({
  lot_id: z.string().uuid().optional(),
  notes: z.string().optional(),
});

const verifyItemSchema = z.object({
  status: z.enum(['verified', 'missing', 'mislocated']),
  found_zone: z.string().optional(),
  notes: z.string().optional(),
});

export default async function floorPlanAuditRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── POST / — start a new audit (snapshots current inventory) ---------------

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = startAuditSchema.parse(request.body);

    // Get all active units for this dealership
    const unitConditions = [eq(units.dealershipId, request.dealershipId), isNull(units.archivedAt)];
    if (body.lot_id) {
      unitConditions.push(eq(units.lotId, body.lot_id));
    }

    const activeUnits = await app.db
      .select({
        id: units.id,
        currentZone: units.currentZone,
      })
      .from(units)
      .where(and(...unitConditions));

    if (activeUnits.length === 0) {
      throw badRequest('No active units found to audit');
    }

    // Create audit + items in transaction
    const result = await app.db.transaction(async (tx) => {
      const [audit] = await tx
        .insert(floorPlanAudits)
        .values({
          dealershipId: request.dealershipId,
          lotId: body.lot_id ?? null,
          startedBy: request.user.sub,
          status: FloorPlanAuditStatus.IN_PROGRESS,
          totalUnits: activeUnits.length,
          verifiedUnits: 0,
          missingUnits: 0,
          notes: body.notes ?? null,
          startedAt: new Date(),
        })
        .returning();

      // Create an audit item for each unit
      const items = activeUnits.map((u) => ({
        auditId: audit!.id,
        unitId: u.id,
        status: AuditItemStatus.PENDING,
        expectedZone: u.currentZone,
      }));

      await tx.insert(floorPlanAuditItems).values(items);

      return audit;
    });

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: 'create',
      entityType: 'floor_plan_audit',
      entityId: result!.id,
      ipAddress: request.ip,
    });

    return reply.status(201).send({ data: result });
  });

  // ── GET / — list audits ----------------------------------------------------

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    const { limit, cursor } = paginationSchema.parse(query);

    const conditions = [eq(floorPlanAudits.dealershipId, request.dealershipId)];

    if (query['status']) {
      conditions.push(eq(floorPlanAudits.status, query['status']));
    }

    const decodedCursor = decodeCursor(cursor);
    if (decodedCursor) {
      conditions.push(eq(floorPlanAudits.id, decodedCursor) as ReturnType<typeof eq>);
    }

    const rows = await app.db
      .select()
      .from(floorPlanAudits)
      .where(and(...conditions))
      .orderBy(desc(floorPlanAudits.createdAt))
      .limit(limit + 1);

    return reply.send(buildPaginatedResponse(rows, limit, cursor));
  });

  // ── GET /:id — get audit with items ----------------------------------------

  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [audit] = await app.db
      .select()
      .from(floorPlanAudits)
      .where(
        and(eq(floorPlanAudits.id, id), eq(floorPlanAudits.dealershipId, request.dealershipId)),
      )
      .limit(1);

    if (!audit) throw notFound('Audit not found');

    // Get items with unit details
    const items = await app.db
      .select({
        item: floorPlanAuditItems,
        stockNumber: units.stockNumber,
        year: units.year,
        make: units.make,
        model: units.model,
        unitType: units.unitType,
        vin: units.vin,
      })
      .from(floorPlanAuditItems)
      .innerJoin(units, eq(floorPlanAuditItems.unitId, units.id))
      .where(eq(floorPlanAuditItems.auditId, id))
      .orderBy(units.stockNumber);

    return reply.send({
      data: {
        ...audit,
        items: items.map((row) => ({
          ...row.item,
          unit: {
            stock_number: row.stockNumber,
            year: row.year,
            make: row.make,
            model: row.model,
            unit_type: row.unitType,
            vin: row.vin,
          },
        })),
      },
    });
  });

  // ── PATCH /:id/items/:itemId — verify or mark unit -------------------------

  app.patch('/:id/items/:itemId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id, itemId } = request.params as { id: string; itemId: string };
    const body = verifyItemSchema.parse(request.body);

    // Verify audit belongs to dealership
    const [audit] = await app.db
      .select()
      .from(floorPlanAudits)
      .where(
        and(eq(floorPlanAudits.id, id), eq(floorPlanAudits.dealershipId, request.dealershipId)),
      )
      .limit(1);

    if (!audit) throw notFound('Audit not found');
    if (audit.status === FloorPlanAuditStatus.COMPLETED) {
      throw badRequest('Audit is already completed');
    }

    const [updated] = await app.db
      .update(floorPlanAuditItems)
      .set({
        status: body.status,
        foundZone: body.found_zone ?? null,
        notes: body.notes ?? null,
        verifiedAt: new Date(),
        verifiedBy: request.user.sub,
      })
      .where(and(eq(floorPlanAuditItems.id, itemId), eq(floorPlanAuditItems.auditId, id)))
      .returning();

    if (!updated) throw notFound('Audit item not found');

    // Update audit counters
    const [verified] = await app.db
      .select({ cnt: count(floorPlanAuditItems.id) })
      .from(floorPlanAuditItems)
      .where(
        and(
          eq(floorPlanAuditItems.auditId, id),
          eq(floorPlanAuditItems.status, AuditItemStatus.VERIFIED),
        ),
      );

    const [missing] = await app.db
      .select({ cnt: count(floorPlanAuditItems.id) })
      .from(floorPlanAuditItems)
      .where(
        and(
          eq(floorPlanAuditItems.auditId, id),
          eq(floorPlanAuditItems.status, AuditItemStatus.MISSING),
        ),
      );

    await app.db
      .update(floorPlanAudits)
      .set({
        verifiedUnits: verified?.cnt ?? 0,
        missingUnits: missing?.cnt ?? 0,
        updatedAt: new Date(),
      })
      .where(eq(floorPlanAudits.id, id));

    return reply.send({ data: updated });
  });

  // ── POST /:id/complete — finalize audit ------------------------------------

  app.post('/:id/complete', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [audit] = await app.db
      .select()
      .from(floorPlanAudits)
      .where(
        and(eq(floorPlanAudits.id, id), eq(floorPlanAudits.dealershipId, request.dealershipId)),
      )
      .limit(1);

    if (!audit) throw notFound('Audit not found');
    if (audit.status === FloorPlanAuditStatus.COMPLETED) {
      throw badRequest('Audit is already completed');
    }

    const [updated] = await app.db
      .update(floorPlanAudits)
      .set({
        status: FloorPlanAuditStatus.COMPLETED,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(floorPlanAudits.id, id))
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: 'update',
      entityType: 'floor_plan_audit',
      entityId: id,
      ipAddress: request.ip,
    });

    return reply.send({ data: updated });
  });
}
