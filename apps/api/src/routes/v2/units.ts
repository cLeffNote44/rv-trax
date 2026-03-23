// ---------------------------------------------------------------------------
// RV Trax API v2 — Units (demonstrates v2 patterns: offset pagination,
// standardized envelope, expanded responses)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, asc, ilike, or, isNull, count } from 'drizzle-orm';
import { units, trackerAssignments, trackers } from '@rv-trax/db';
import { z } from 'zod';

// ── v2 query schema with offset pagination ──────────────────────────────────

const v2ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.string().optional(),
  search: z.string().optional(),
  sort: z
    .enum(['stock_number', 'year', 'make', 'status', 'created_at', 'updated_at'])
    .default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// ── v2 response envelope ────────────────────────────────────────────────────

interface V2Envelope<T> {
  data: T;
  meta: {
    api_version: number;
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
  errors: null;
}

export function registerV2UnitRoutes(app: FastifyInstance): void {
  // ── GET /units — v2 list with offset pagination + total count ──────────

  app.get('/units', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = v2ListQuerySchema.parse(request.query);
    const { page, limit, status, search, sort, order } = query;
    const offset = (page - 1) * limit;

    const conditions = [eq(units.dealershipId, request.dealershipId), isNull(units.archivedAt)];

    if (status) {
      conditions.push(eq(units.status, status));
    }

    if (search) {
      conditions.push(
        or(
          ilike(units.stockNumber, `%${search}%`),
          ilike(units.vin, `%${search}%`),
          ilike(units.make, `%${search}%`),
          ilike(units.model, `%${search}%`),
        )!,
      );
    }

    // Get total count
    const [totalResult] = await app.db
      .select({ total: count(units.id) })
      .from(units)
      .where(and(...conditions));

    const total = totalResult?.total ?? 0;

    // Sort mapping
    const sortColumn =
      {
        stock_number: units.stockNumber,
        year: units.year,
        make: units.make,
        status: units.status,
        created_at: units.createdAt,
        updated_at: units.updatedAt,
      }[sort] ?? units.createdAt;

    const orderFn = order === 'asc' ? asc : desc;

    // Fetch page
    const rows = await app.db
      .select()
      .from(units)
      .where(and(...conditions))
      .orderBy(orderFn(sortColumn))
      .limit(limit)
      .offset(offset);

    // Fetch tracker info for these units
    const unitIds = rows.map((r) => r.id);
    const trackerInfo =
      unitIds.length > 0
        ? await app.db
            .select({
              unitId: trackerAssignments.unitId,
              trackerId: trackers.id,
              deviceEui: trackers.deviceEui,
              batteryPct: trackers.batteryPct,
              status: trackers.status,
            })
            .from(trackerAssignments)
            .innerJoin(trackers, eq(trackerAssignments.trackerId, trackers.id))
            .where(isNull(trackerAssignments.unassignedAt))
        : [];

    const trackerMap = new Map(
      trackerInfo.filter((t) => unitIds.includes(t.unitId!)).map((t) => [t.unitId, t]),
    );

    // Build expanded response with embedded tracker
    const expandedUnits = rows.map((unit) => {
      const tracker = trackerMap.get(unit.id);
      return {
        ...unit,
        tracker: tracker
          ? {
              id: tracker.trackerId,
              device_eui: tracker.deviceEui,
              battery_pct: tracker.batteryPct,
              status: tracker.status,
            }
          : null,
      };
    });

    const totalPages = Math.ceil(total / limit);

    const response: V2Envelope<typeof expandedUnits> = {
      data: expandedUnits,
      meta: {
        api_version: 2,
        page,
        limit,
        total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
      errors: null,
    };

    return reply.send(response);
  });

  // ── GET /units/:id — v2 single unit with expanded relations ────────────

  app.get('/units/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [unit] = await app.db
      .select()
      .from(units)
      .where(and(eq(units.id, id), eq(units.dealershipId, request.dealershipId)))
      .limit(1);

    if (!unit) {
      return reply.status(404).send({
        data: null,
        meta: { api_version: 2 },
        errors: [{ code: 'NOT_FOUND', message: 'Unit not found' }],
      });
    }

    // Get tracker assignment
    const [tracker] = await app.db
      .select({
        trackerId: trackers.id,
        deviceEui: trackers.deviceEui,
        batteryPct: trackers.batteryPct,
        status: trackers.status,
        lastSeen: trackers.lastSeen,
      })
      .from(trackerAssignments)
      .innerJoin(trackers, eq(trackerAssignments.trackerId, trackers.id))
      .where(and(eq(trackerAssignments.unitId, id), isNull(trackerAssignments.unassignedAt)))
      .limit(1);

    return reply.send({
      data: {
        ...unit,
        tracker: tracker
          ? {
              id: tracker.trackerId,
              device_eui: tracker.deviceEui,
              battery_pct: tracker.batteryPct,
              status: tracker.status,
              last_seen: tracker.lastSeen,
            }
          : null,
      },
      meta: { api_version: 2 },
      errors: null,
    });
  });
}
