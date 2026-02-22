// ---------------------------------------------------------------------------
// RV Trax API — Location history routes
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { locationHistory, movementEvents, units } from '@rv-trax/db';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, badRequest } from '../utils/errors.js';
import { sql } from 'drizzle-orm';

// ── Query param types ------------------------------------------------------

interface LocationHistoryQuery {
  from?: string;
  to?: string;
  interval?: 'raw' | 'hourly' | 'daily';
}

interface MovementHistoryQuery {
  from?: string;
  to?: string;
  limit?: string;
  cursor?: string;
}

export default async function locationRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth + tenant
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── GET /units/:id/location-history ----------------------------------------

  app.get('/units/:id/location-history', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const query = request.query as LocationHistoryQuery;

    // Verify unit belongs to dealership
    const [unit] = await app.db
      .select({ id: units.id })
      .from(units)
      .where(
        and(
          eq(units.id, id),
          eq(units.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!unit) {
      throw notFound('Unit not found');
    }

    const from = query.from ? new Date(query.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : new Date();
    const interval = query.interval ?? 'raw';

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw badRequest('Invalid date format for "from" or "to" parameter');
    }

    if (interval === 'raw') {
      const rows = await app.db
        .select({
          time: locationHistory.time,
          latitude: locationHistory.latitude,
          longitude: locationHistory.longitude,
          zone: locationHistory.zone,
          row: locationHistory.rowLabel,
          spot: locationHistory.spotNumber,
          source: locationHistory.source,
          accuracy: locationHistory.accuracyMeters,
        })
        .from(locationHistory)
        .where(
          and(
            eq(locationHistory.unitId, id),
            eq(locationHistory.dealershipId, request.dealershipId),
            gte(locationHistory.time, from),
            lte(locationHistory.time, to),
          ),
        )
        .orderBy(desc(locationHistory.time))
        .limit(1000);

      return reply.status(200).send({ data: rows });
    }

    // For hourly / daily: use DISTINCT ON with date_trunc to pick last record per bucket.
    // Using raw SQL for the time-bucket grouping since Drizzle does not
    // natively support date_trunc + DISTINCT ON in a type-safe way.

    const bucket = interval === 'hourly' ? 'hour' : 'day';

    const rows = await app.db.execute(sql`
      SELECT DISTINCT ON (date_trunc(${bucket}, lh.time))
        lh.time,
        lh.latitude,
        lh.longitude,
        lh.zone,
        lh.row_label AS row,
        lh.spot_number AS spot,
        lh.source,
        lh.accuracy_meters AS accuracy
      FROM location_history lh
      WHERE lh.unit_id = ${id}
        AND lh.dealership_id = ${request.dealershipId}
        AND lh.time >= ${from.toISOString()}
        AND lh.time <= ${to.toISOString()}
      ORDER BY date_trunc(${bucket}, lh.time) DESC, lh.time DESC
      LIMIT 1000
    `);

    return reply.status(200).send({ data: rows });
  });

  // ── GET /units/:id/movement-history ----------------------------------------

  app.get('/units/:id/movement-history', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const query = request.query as MovementHistoryQuery;

    // Verify unit belongs to dealership
    const [unit] = await app.db
      .select({ id: units.id })
      .from(units)
      .where(
        and(
          eq(units.id, id),
          eq(units.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!unit) {
      throw notFound('Unit not found');
    }

    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    const limit = Math.min(parseInt(query.limit ?? '50', 10) || 50, 200);
    const cursorDate = query.cursor ? new Date(Buffer.from(query.cursor, 'base64url').toString('utf-8')) : undefined;

    const conditions = [
      eq(movementEvents.unitId, id),
      eq(movementEvents.dealershipId, request.dealershipId),
    ];

    if (from) conditions.push(gte(movementEvents.occurredAt, from));
    if (to) conditions.push(lte(movementEvents.occurredAt, to));
    if (cursorDate) conditions.push(lte(movementEvents.occurredAt, cursorDate));

    const rows = await app.db
      .select({
        id: movementEvents.id,
        from_zone: movementEvents.fromZone,
        from_row: movementEvents.fromRow,
        from_spot: movementEvents.fromSpot,
        to_zone: movementEvents.toZone,
        to_row: movementEvents.toRow,
        to_spot: movementEvents.toSpot,
        distance_meters: movementEvents.distanceMeters,
        occurred_at: movementEvents.occurredAt,
      })
      .from(movementEvents)
      .where(and(...conditions))
      .orderBy(desc(movementEvents.occurredAt))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const lastItem = page[page.length - 1];
    const nextCursor = hasMore && lastItem
      ? Buffer.from(lastItem.occurred_at.toISOString(), 'utf-8').toString('base64url')
      : null;

    return reply.status(200).send({
      data: page,
      pagination: {
        next_cursor: nextCursor,
        has_more: hasMore,
      },
    });
  });

  // ── GET /lots/:id/live-positions -------------------------------------------

  app.get('/lots/:id/live-positions', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: lotId } = request.params as { id: string };

    // Fetch all live positions from Redis for this lot.
    // Convention: keys are stored as `lot:{lotId}:positions` as a hash
    // where field = unitId, value = JSON with position data.
    // Fallback: if no Redis data, query DB for units on this lot.

    const redisKey = `lot:${lotId}:positions`;
    const cached = await app.redis.hgetall(redisKey);

    if (cached && Object.keys(cached).length > 0) {
      const positions = Object.entries(cached).map(([_unitId, json]) => {
        try {
          return JSON.parse(json) as Record<string, unknown>;
        } catch {
          return null;
        }
      }).filter(Boolean);

      return reply.status(200).send({ data: positions });
    }

    // Fallback: query DB for units assigned to this lot with their current position
    const rows = await app.db
      .select({
        unit_id: units.id,
        stock_number: units.stockNumber,
        make: units.make,
        model: units.model,
        status: units.status,
        zone: units.currentZone,
        row: units.currentRow,
        spot: units.currentSpot,
        updated_at: units.updatedAt,
      })
      .from(units)
      .where(
        and(
          eq(units.lotId, lotId),
          eq(units.dealershipId, request.dealershipId),
        ),
      );

    // Enrich with lat/lng from the most recent location_history record per unit.
    // For performance, we do a single query using a lateral join pattern via
    // raw SQL. If there are no location records, lat/lng will be null.
    const unitIds = rows.map((r) => r.unit_id);

    const latLngMap = new Map<string, { latitude: string; longitude: string }>();

    if (unitIds.length > 0) {
      // Fetch the latest location for each unit in this set
      const latestLocations = await app.db.execute(sql`
        SELECT DISTINCT ON (lh.unit_id)
          lh.unit_id,
          lh.latitude,
          lh.longitude
        FROM location_history lh
        WHERE lh.unit_id = ANY(${unitIds})
          AND lh.dealership_id = ${request.dealershipId}
        ORDER BY lh.unit_id, lh.time DESC
      `);

      for (const loc of latestLocations) {
        const row = loc as { unit_id: string; latitude: string; longitude: string };
        latLngMap.set(row.unit_id, {
          latitude: row.latitude,
          longitude: row.longitude,
        });
      }
    }

    const positions = rows.map((r) => {
      const coords = latLngMap.get(r.unit_id);
      return {
        unit_id: r.unit_id,
        stock_number: r.stock_number,
        make: r.make,
        model: r.model,
        status: r.status,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
        zone: r.zone,
        row: r.row,
        spot: r.spot,
        last_updated: r.updated_at,
      };
    });

    return reply.status(200).send({ data: positions });
  });

  // ── GET /trackers/:id/location-history -------------------------------------

  app.get('/trackers/:id/location-history', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const query = request.query as LocationHistoryQuery;

    // Verify tracker belongs to dealership by checking tracker_assignments or
    // that the tracker's dealershipId matches
    const from = query.from ? new Date(query.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : new Date();
    const interval = query.interval ?? 'raw';

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw badRequest('Invalid date format for "from" or "to" parameter');
    }

    if (interval === 'raw') {
      const rows = await app.db
        .select({
          time: locationHistory.time,
          latitude: locationHistory.latitude,
          longitude: locationHistory.longitude,
          zone: locationHistory.zone,
          row: locationHistory.rowLabel,
          spot: locationHistory.spotNumber,
          source: locationHistory.source,
          accuracy: locationHistory.accuracyMeters,
        })
        .from(locationHistory)
        .where(
          and(
            eq(locationHistory.trackerId, id),
            eq(locationHistory.dealershipId, request.dealershipId),
            gte(locationHistory.time, from),
            lte(locationHistory.time, to),
          ),
        )
        .orderBy(desc(locationHistory.time))
        .limit(1000);

      return reply.status(200).send({ data: rows });
    }

    const bucket = interval === 'hourly' ? 'hour' : 'day';

    const rows = await app.db.execute(sql`
      SELECT DISTINCT ON (date_trunc(${bucket}, lh.time))
        lh.time,
        lh.latitude,
        lh.longitude,
        lh.zone,
        lh.row_label AS row,
        lh.spot_number AS spot,
        lh.source,
        lh.accuracy_meters AS accuracy
      FROM location_history lh
      WHERE lh.tracker_id = ${id}
        AND lh.dealership_id = ${request.dealershipId}
        AND lh.time >= ${from.toISOString()}
        AND lh.time <= ${to.toISOString()}
      ORDER BY date_trunc(${bucket}, lh.time) DESC, lh.time DESC
      LIMIT 1000
    `);

    return reply.status(200).send({ data: rows });
  });
}
