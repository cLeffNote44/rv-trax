// ---------------------------------------------------------------------------
// RV Trax API — Geo-fence routes (CRUD + events)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, isNull, desc, gt } from 'drizzle-orm';
import { geoFences, geoFenceEvents, lots, units } from '@rv-trax/db';
import { createGeoFenceSchema } from '@rv-trax/shared';
import { AuditAction, GeoFenceType } from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, validationError, badRequest } from '../utils/errors.js';
import { decodeCursor, encodeCursor } from '../utils/pagination.js';
import { logAction } from '../services/audit.js';
import {
  validatePolygon,
  coordsToPolygon,
  calculatePolygonCentroid,
  isPointInPolygon,
} from '../services/geofence.js';
import { z } from 'zod';

// ── Local schemas -----------------------------------------------------------

const updateGeoFenceSchema = z.object({
  name: z.string().min(1).optional(),
  boundary: z.array(z.tuple([z.number(), z.number()])).min(3).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a hex string (#RRGGBB)').optional(),
  is_active: z.boolean().optional(),
});

const eventQuerySchema = z.object({
  event_type: z.enum(['enter', 'exit']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export default async function geofenceRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth + tenant
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── POST /lots/:lotId/geofences — create geo-fence -----------------------

  app.post('/lots/:lotId/geofences', async (request: FastifyRequest, reply: FastifyReply) => {
    const { lotId } = request.params as { lotId: string };
    const body = createGeoFenceSchema.parse(request.body);

    // Verify lot exists and belongs to dealership
    const [lot] = await app.db
      .select()
      .from(lots)
      .where(
        and(
          eq(lots.id, lotId),
          eq(lots.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!lot) {
      throw notFound('Lot not found');
    }

    // Validate polygon geometry
    const validation = validatePolygon(body.boundary);
    if (!validation.valid) {
      throw validationError(validation.error ?? 'Invalid polygon');
    }

    const boundaryCoords = validation.normalised ?? body.boundary;

    // If fence_type is NOT lot_boundary, validate it is within the lot boundary
    if (body.fence_type !== GeoFenceType.LOT_BOUNDARY && lot.boundary) {
      const lotBoundary = JSON.parse(lot.boundary) as Array<[number, number]>;
      const lotPolygon = coordsToPolygon(lotBoundary);

      // Check centroid of new fence is inside lot boundary
      const newPolygon = coordsToPolygon(boundaryCoords);
      const centroid = calculatePolygonCentroid(newPolygon);

      if (!isPointInPolygon(centroid, lotPolygon)) {
        throw validationError(
          'Non-boundary geo-fence centroid must be within the lot boundary',
        );
      }
    }

    const [fence] = await app.db
      .insert(geoFences)
      .values({
        lotId,
        dealershipId: request.dealershipId,
        name: body.name,
        fenceType: body.fence_type,
        boundary: JSON.stringify(boundaryCoords),
        color: body.color ?? '#3B82F6',
      })
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.CREATE,
      entityType: 'geo_fence',
      entityId: fence!.id,
      ipAddress: request.ip,
    });

    return reply.status(201).send({ data: fence });
  });

  // ── GET /lots/:lotId/geofences — list geo-fences for a lot ---------------

  app.get('/lots/:lotId/geofences', async (request: FastifyRequest, reply: FastifyReply) => {
    const { lotId } = request.params as { lotId: string };

    // Verify lot exists and belongs to dealership
    const [lot] = await app.db
      .select({ id: lots.id })
      .from(lots)
      .where(
        and(
          eq(lots.id, lotId),
          eq(lots.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!lot) {
      throw notFound('Lot not found');
    }

    const rows = await app.db
      .select({
        id: geoFences.id,
        name: geoFences.name,
        fenceType: geoFences.fenceType,
        boundary: geoFences.boundary,
        color: geoFences.color,
        isActive: geoFences.isActive,
        createdAt: geoFences.createdAt,
      })
      .from(geoFences)
      .where(
        and(
          eq(geoFences.lotId, lotId),
          eq(geoFences.dealershipId, request.dealershipId),
          isNull(geoFences.deletedAt),
        ),
      )
      .orderBy(geoFences.createdAt);

    return reply.status(200).send({ data: rows });
  });

  // ── GET /geofences/:id — single geo-fence detail -------------------------

  app.get('/geofences/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [fence] = await app.db
      .select()
      .from(geoFences)
      .where(
        and(
          eq(geoFences.id, id),
          eq(geoFences.dealershipId, request.dealershipId),
          isNull(geoFences.deletedAt),
        ),
      )
      .limit(1);

    if (!fence) {
      throw notFound('Geo-fence not found');
    }

    // Fetch last 50 events with unit info
    const recentEvents = await app.db
      .select({
        id: geoFenceEvents.id,
        eventType: geoFenceEvents.eventType,
        occurredAt: geoFenceEvents.occurredAt,
        unitId: geoFenceEvents.unitId,
        stockNumber: units.stockNumber,
        make: units.make,
        model: units.model,
      })
      .from(geoFenceEvents)
      .leftJoin(units, eq(units.id, geoFenceEvents.unitId))
      .where(eq(geoFenceEvents.geoFenceId, id))
      .orderBy(desc(geoFenceEvents.occurredAt))
      .limit(50);

    return reply.status(200).send({
      data: {
        ...fence,
        recent_events: recentEvents,
      },
    });
  });

  // ── PATCH /geofences/:id — update geo-fence ------------------------------

  app.patch('/geofences/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateGeoFenceSchema.parse(request.body);

    const [existing] = await app.db
      .select()
      .from(geoFences)
      .where(
        and(
          eq(geoFences.id, id),
          eq(geoFences.dealershipId, request.dealershipId),
          isNull(geoFences.deletedAt),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('Geo-fence not found');
    }

    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      updates['name'] = body.name;
    }

    if (body.color !== undefined) {
      updates['color'] = body.color;
    }

    if (body.is_active !== undefined) {
      updates['isActive'] = body.is_active;
    }

    if (body.boundary !== undefined) {
      const validation = validatePolygon(body.boundary);
      if (!validation.valid) {
        throw validationError(validation.error ?? 'Invalid polygon');
      }
      updates['boundary'] = JSON.stringify(validation.normalised ?? body.boundary);
    }

    if (Object.keys(updates).length === 0) {
      throw badRequest('No updatable fields provided');
    }

    const [updated] = await app.db
      .update(geoFences)
      .set(updates)
      .where(eq(geoFences.id, id))
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.UPDATE,
      entityType: 'geo_fence',
      entityId: id,
      changes: body as Record<string, unknown>,
      ipAddress: request.ip,
    });

    return reply.status(200).send({ data: updated });
  });

  // ── DELETE /geofences/:id — soft delete -----------------------------------

  app.delete('/geofences/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [existing] = await app.db
      .select({ id: geoFences.id })
      .from(geoFences)
      .where(
        and(
          eq(geoFences.id, id),
          eq(geoFences.dealershipId, request.dealershipId),
          isNull(geoFences.deletedAt),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('Geo-fence not found');
    }

    await app.db
      .update(geoFences)
      .set({ deletedAt: new Date(), isActive: false })
      .where(eq(geoFences.id, id));

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.DELETE,
      entityType: 'geo_fence',
      entityId: id,
      ipAddress: request.ip,
    });

    return reply.status(200).send({ message: 'Geo-fence deleted successfully' });
  });

  // ── GET /geofences/:id/events — paginated geo-fence events ---------------

  app.get('/geofences/:id/events', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const query = eventQuerySchema.parse(request.query);

    // Verify geo-fence exists and belongs to dealership
    const [fence] = await app.db
      .select({ id: geoFences.id })
      .from(geoFences)
      .where(
        and(
          eq(geoFences.id, id),
          eq(geoFences.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!fence) {
      throw notFound('Geo-fence not found');
    }

    const conditions: ReturnType<typeof eq>[] = [
      eq(geoFenceEvents.geoFenceId, id),
    ];

    if (query.event_type) {
      conditions.push(eq(geoFenceEvents.eventType, query.event_type));
    }

    if (query.cursor) {
      const decodedId = decodeCursor(query.cursor);
      conditions.push(gt(geoFenceEvents.id, decodedId));
    }

    const rows = await app.db
      .select({
        id: geoFenceEvents.id,
        eventType: geoFenceEvents.eventType,
        occurredAt: geoFenceEvents.occurredAt,
        unitId: geoFenceEvents.unitId,
        stockNumber: units.stockNumber,
        make: units.make,
        model: units.model,
      })
      .from(geoFenceEvents)
      .leftJoin(units, eq(units.id, geoFenceEvents.unitId))
      .where(and(...conditions))
      .orderBy(desc(geoFenceEvents.occurredAt))
      .limit(query.limit + 1);

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const lastItem = page[page.length - 1];
    const nextCursor = hasMore && lastItem ? encodeCursor(lastItem.id) : null;

    return reply.status(200).send({
      data: page,
      pagination: {
        next_cursor: nextCursor,
        has_more: hasMore,
      },
    });
  });
}
