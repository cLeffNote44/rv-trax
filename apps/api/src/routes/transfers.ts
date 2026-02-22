// ---------------------------------------------------------------------------
// RV Trax API — Unit transfer routes (GET/POST /api/v1/transfers)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, or, desc, inArray } from 'drizzle-orm';
import { unitTransfers, units, dealerships } from '@rv-trax/db';
import {
  createTransferSchema,
  AuditAction,
  TransferStatus,
} from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, badRequest } from '../utils/errors.js';
import { logAction } from '../services/audit.js';

// ── Route registration -------------------------------------------------------

export default async function transferRoutes(
  app: FastifyInstance,
): Promise<void> {
  // All routes require auth + tenant
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── POST / — initiate a transfer ------------------------------------------

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createTransferSchema.parse(request.body);

    // Verify unit exists and belongs to current dealership
    const [unit] = await app.db
      .select({ id: units.id, dealershipId: units.dealershipId, lotId: units.lotId })
      .from(units)
      .where(
        and(
          eq(units.id, body.unit_id),
          eq(units.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!unit) {
      throw notFound('Unit not found or does not belong to your dealership');
    }

    // Verify target dealership exists
    const [targetDealership] = await app.db
      .select({ id: dealerships.id })
      .from(dealerships)
      .where(eq(dealerships.id, body.to_dealership_id))
      .limit(1);

    if (!targetDealership) {
      throw notFound('Target dealership not found');
    }

    if (body.to_dealership_id === request.dealershipId) {
      throw badRequest('Cannot transfer a unit to the same dealership');
    }

    // Create transfer record
    const [transfer] = await app.db
      .insert(unitTransfers)
      .values({
        unitId: body.unit_id,
        fromDealershipId: request.dealershipId,
        toDealershipId: body.to_dealership_id,
        fromLotId: unit.lotId ?? null,
        toLotId: body.to_lot_id ?? null,
        status: TransferStatus.INITIATED,
        initiatedBy: request.user.sub,
        notes: body.notes ?? null,
      })
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.CREATE,
      entityType: 'unit_transfer',
      entityId: transfer!.id,
      changes: {
        unit_id: body.unit_id,
        to_dealership_id: body.to_dealership_id,
      },
      ipAddress: request.ip,
    });

    return reply.status(201).send({ data: transfer });
  });

  // ── GET / — list transfers (filter by status, direction) -------------------

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    const status = query['status'];
    const direction = query['direction']; // 'outgoing' | 'incoming'

    // Build direction condition
    let directionCondition;
    if (direction === 'outgoing') {
      directionCondition = eq(
        unitTransfers.fromDealershipId,
        request.dealershipId,
      );
    } else if (direction === 'incoming') {
      directionCondition = eq(
        unitTransfers.toDealershipId,
        request.dealershipId,
      );
    } else {
      // Default: show both incoming and outgoing
      directionCondition = or(
        eq(unitTransfers.fromDealershipId, request.dealershipId),
        eq(unitTransfers.toDealershipId, request.dealershipId),
      );
    }

    const conditions = [directionCondition!];

    if (status) {
      conditions.push(eq(unitTransfers.status, status));
    }

    const rows = await app.db
      .select({
        id: unitTransfers.id,
        unitId: unitTransfers.unitId,
        fromDealershipId: unitTransfers.fromDealershipId,
        toDealershipId: unitTransfers.toDealershipId,
        fromLotId: unitTransfers.fromLotId,
        toLotId: unitTransfers.toLotId,
        status: unitTransfers.status,
        initiatedBy: unitTransfers.initiatedBy,
        notes: unitTransfers.notes,
        departedAt: unitTransfers.departedAt,
        arrivedAt: unitTransfers.arrivedAt,
        completedAt: unitTransfers.completedAt,
        createdAt: unitTransfers.createdAt,
        // Unit info
        stockNumber: units.stockNumber,
        make: units.make,
        model: units.model,
        year: units.year,
        // From dealership
        fromDealershipName: dealerships.name,
      })
      .from(unitTransfers)
      .innerJoin(units, eq(units.id, unitTransfers.unitId))
      .innerJoin(
        dealerships,
        eq(dealerships.id, unitTransfers.fromDealershipId),
      )
      .where(and(...conditions))
      .orderBy(desc(unitTransfers.createdAt));

    // Fetch "to" dealership names separately to avoid alias complexity
    const toDealershipIds = [
      ...new Set(rows.map((r) => r.toDealershipId)),
    ];

    let toNameMap = new Map<string, string>();
    if (toDealershipIds.length > 0) {
      const toDealershipRows = await app.db
        .select({ id: dealerships.id, name: dealerships.name })
        .from(dealerships)
        .where(inArray(dealerships.id, toDealershipIds));

      toNameMap = new Map(toDealershipRows.map((d) => [d.id, d.name]));
    }

    const enriched = rows.map((row) => ({
      ...row,
      toDealershipName: toNameMap.get(row.toDealershipId) ?? 'Unknown',
    }));

    return reply.status(200).send({ data: enriched });
  });

  // ── GET /:id — transfer detail ---------------------------------------------

  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [transfer] = await app.db
      .select()
      .from(unitTransfers)
      .where(
        and(
          eq(unitTransfers.id, id),
          or(
            eq(unitTransfers.fromDealershipId, request.dealershipId),
            eq(unitTransfers.toDealershipId, request.dealershipId),
          ),
        ),
      )
      .limit(1);

    if (!transfer) {
      throw notFound('Transfer not found');
    }

    // Fetch related unit
    const [unit] = await app.db
      .select({
        stockNumber: units.stockNumber,
        vin: units.vin,
        year: units.year,
        make: units.make,
        model: units.model,
        status: units.status,
      })
      .from(units)
      .where(eq(units.id, transfer.unitId))
      .limit(1);

    // Fetch from/to dealership names
    const [fromDealership] = await app.db
      .select({ name: dealerships.name })
      .from(dealerships)
      .where(eq(dealerships.id, transfer.fromDealershipId))
      .limit(1);

    const [toDealership] = await app.db
      .select({ name: dealerships.name })
      .from(dealerships)
      .where(eq(dealerships.id, transfer.toDealershipId))
      .limit(1);

    return reply.status(200).send({
      data: {
        ...transfer,
        unit: unit ?? null,
        fromDealershipName: fromDealership?.name ?? 'Unknown',
        toDealershipName: toDealership?.name ?? 'Unknown',
      },
    });
  });

  // ── POST /:id/depart — mark as departed -----------------------------------

  app.post(
    '/:id/depart',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const [transfer] = await app.db
        .select()
        .from(unitTransfers)
        .where(
          and(
            eq(unitTransfers.id, id),
            eq(unitTransfers.fromDealershipId, request.dealershipId),
          ),
        )
        .limit(1);

      if (!transfer) {
        throw notFound('Transfer not found');
      }

      if (transfer.status !== TransferStatus.INITIATED) {
        throw badRequest(
          `Cannot depart a transfer with status "${transfer.status}". Expected "initiated".`,
        );
      }

      const [updated] = await app.db
        .update(unitTransfers)
        .set({
          status: TransferStatus.IN_TRANSIT,
          departedAt: new Date(),
        })
        .where(eq(unitTransfers.id, id))
        .returning();

      await logAction(app.db, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: AuditAction.STATUS_CHANGE,
        entityType: 'unit_transfer',
        entityId: id,
        changes: { status: TransferStatus.IN_TRANSIT },
        ipAddress: request.ip,
      });

      return reply.status(200).send({ data: updated });
    },
  );

  // ── POST /:id/arrive — mark as arrived at destination ----------------------

  app.post(
    '/:id/arrive',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const [transfer] = await app.db
        .select()
        .from(unitTransfers)
        .where(
          and(
            eq(unitTransfers.id, id),
            eq(unitTransfers.toDealershipId, request.dealershipId),
          ),
        )
        .limit(1);

      if (!transfer) {
        throw notFound('Transfer not found');
      }

      if (transfer.status !== TransferStatus.IN_TRANSIT) {
        throw badRequest(
          `Cannot mark arrival for a transfer with status "${transfer.status}". Expected "in_transit".`,
        );
      }

      const [updated] = await app.db
        .update(unitTransfers)
        .set({
          status: TransferStatus.ARRIVED,
          arrivedAt: new Date(),
        })
        .where(eq(unitTransfers.id, id))
        .returning();

      await logAction(app.db, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: AuditAction.STATUS_CHANGE,
        entityType: 'unit_transfer',
        entityId: id,
        changes: { status: TransferStatus.ARRIVED },
        ipAddress: request.ip,
      });

      return reply.status(200).send({ data: updated });
    },
  );

  // ── POST /:id/complete — complete transfer (reassign unit) -----------------

  app.post(
    '/:id/complete',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const [transfer] = await app.db
        .select()
        .from(unitTransfers)
        .where(
          and(
            eq(unitTransfers.id, id),
            eq(unitTransfers.toDealershipId, request.dealershipId),
          ),
        )
        .limit(1);

      if (!transfer) {
        throw notFound('Transfer not found');
      }

      if (transfer.status !== TransferStatus.ARRIVED) {
        throw badRequest(
          `Cannot complete a transfer with status "${transfer.status}". Expected "arrived".`,
        );
      }

      // Complete transfer: update status, reassign unit, and audit in a single transaction
      const updated = await app.db.transaction(async (tx) => {
        const [txUpdated] = await tx
          .update(unitTransfers)
          .set({
            status: TransferStatus.COMPLETED,
            completedAt: new Date(),
          })
          .where(eq(unitTransfers.id, id))
          .returning();

        // Reassign unit to destination dealership
        const unitUpdates: Record<string, unknown> = {
          dealershipId: transfer.toDealershipId,
          updatedAt: new Date(),
        };

        if (transfer.toLotId) {
          unitUpdates['lotId'] = transfer.toLotId;
        } else {
          unitUpdates['lotId'] = null;
        }

        // Clear location fields since unit is at a new dealership
        unitUpdates['currentZone'] = null;
        unitUpdates['currentRow'] = null;
        unitUpdates['currentSpot'] = null;

        await tx
          .update(units)
          .set(unitUpdates)
          .where(eq(units.id, transfer.unitId));

        // Audit log on source dealership
        await logAction(tx, {
          dealershipId: transfer.fromDealershipId,
          userId: request.user.sub,
          action: AuditAction.STATUS_CHANGE,
          entityType: 'unit_transfer',
          entityId: id,
          changes: {
            status: TransferStatus.COMPLETED,
            unit_reassigned_to: transfer.toDealershipId,
          },
          ipAddress: request.ip,
        });

        // Audit log on destination dealership
        await logAction(tx, {
          dealershipId: transfer.toDealershipId,
          userId: request.user.sub,
          action: AuditAction.STATUS_CHANGE,
          entityType: 'unit_transfer',
          entityId: id,
          changes: {
            status: TransferStatus.COMPLETED,
            unit_received_from: transfer.fromDealershipId,
          },
          ipAddress: request.ip,
        });

        return txUpdated;
      });

      return reply.status(200).send({ data: updated });
    },
  );

  // ── POST /:id/cancel — cancel transfer ------------------------------------

  app.post(
    '/:id/cancel',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const [transfer] = await app.db
        .select()
        .from(unitTransfers)
        .where(
          and(
            eq(unitTransfers.id, id),
            or(
              eq(unitTransfers.fromDealershipId, request.dealershipId),
              eq(unitTransfers.toDealershipId, request.dealershipId),
            ),
          ),
        )
        .limit(1);

      if (!transfer) {
        throw notFound('Transfer not found');
      }

      if (transfer.status === TransferStatus.COMPLETED) {
        throw badRequest('Cannot cancel a completed transfer');
      }

      if (transfer.status === TransferStatus.CANCELLED) {
        throw badRequest('Transfer is already cancelled');
      }

      const [updated] = await app.db
        .update(unitTransfers)
        .set({ status: TransferStatus.CANCELLED })
        .where(eq(unitTransfers.id, id))
        .returning();

      await logAction(app.db, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: AuditAction.STATUS_CHANGE,
        entityType: 'unit_transfer',
        entityId: id,
        changes: { status: TransferStatus.CANCELLED },
        ipAddress: request.ip,
      });

      return reply.status(200).send({ data: updated });
    },
  );
}
