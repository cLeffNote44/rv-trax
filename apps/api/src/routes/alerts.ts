// ---------------------------------------------------------------------------
// RV Trax API — Alert management routes (GET/POST /api/v1/alerts)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, ne, count, desc, lt, gte, lte, inArray } from 'drizzle-orm';
import { alerts, units, trackers, gateways, geoFences } from '@rv-trax/db';
import {
  AlertSeverity,
  AlertStatus,
  alertQuerySchema,
  snoozeAlertSchema,
  bulkAcknowledgeSchema,
} from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, badRequest } from '../utils/errors.js';
import { decodeCursor, encodeCursor } from '../utils/pagination.js';

// ── Duration map ------------------------------------------------------------

const SNOOZE_DURATIONS: Record<string, number> = {
  '1h': 1 * 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
};

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export default async function alertRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth + tenant
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── GET / — list alerts for dealership -----------------------------------

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = alertQuerySchema.parse(request.query);

    const conditions: ReturnType<typeof eq>[] = [
      eq(alerts.dealershipId, request.dealershipId),
    ];

    if (query.status) {
      conditions.push(eq(alerts.status, query.status));
    }

    if (query.severity) {
      conditions.push(eq(alerts.severity, query.severity));
    }

    if (query.alert_type) {
      conditions.push(eq(alerts.alertType, query.alert_type));
    }

    if (query.unit_id) {
      conditions.push(eq(alerts.unitId, query.unit_id));
    }

    if (query.from) {
      conditions.push(gte(alerts.createdAt, new Date(query.from)));
    }

    if (query.to) {
      conditions.push(lte(alerts.createdAt, new Date(query.to)));
    }

    if (query.cursor) {
      const decodedId = decodeCursor(query.cursor);
      conditions.push(lt(alerts.id, decodedId));
    }

    const where = and(...conditions);

    const rows = await app.db
      .select({
        id: alerts.id,
        alertType: alerts.alertType,
        severity: alerts.severity,
        title: alerts.title,
        message: alerts.message,
        status: alerts.status,
        unitId: alerts.unitId,
        trackerId: alerts.trackerId,
        gatewayId: alerts.gatewayId,
        geoFenceId: alerts.geoFenceId,
        acknowledgedAt: alerts.acknowledgedAt,
        snoozedUntil: alerts.snoozedUntil,
        createdAt: alerts.createdAt,
      })
      .from(alerts)
      .where(where)
      .orderBy(desc(alerts.createdAt))
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

  // ── GET /unread-count — count of unacknowledged alerts by severity -------

  app.get('/unread-count', async (request: FastifyRequest, reply: FastifyReply) => {
    // Count all new (unacknowledged) alerts
    const [totalResult] = await app.db
      .select({ value: count() })
      .from(alerts)
      .where(
        and(
          eq(alerts.dealershipId, request.dealershipId),
          eq(alerts.status, AlertStatus.NEW_ALERT),
        ),
      );

    const [criticalResult] = await app.db
      .select({ value: count() })
      .from(alerts)
      .where(
        and(
          eq(alerts.dealershipId, request.dealershipId),
          eq(alerts.status, AlertStatus.NEW_ALERT),
          eq(alerts.severity, AlertSeverity.CRITICAL),
        ),
      );

    const [warningResult] = await app.db
      .select({ value: count() })
      .from(alerts)
      .where(
        and(
          eq(alerts.dealershipId, request.dealershipId),
          eq(alerts.status, AlertStatus.NEW_ALERT),
          eq(alerts.severity, AlertSeverity.WARNING),
        ),
      );

    const [infoResult] = await app.db
      .select({ value: count() })
      .from(alerts)
      .where(
        and(
          eq(alerts.dealershipId, request.dealershipId),
          eq(alerts.status, AlertStatus.NEW_ALERT),
          eq(alerts.severity, AlertSeverity.INFO),
        ),
      );

    return reply.status(200).send({
      data: {
        total: totalResult?.value ?? 0,
        critical: criticalResult?.value ?? 0,
        warning: warningResult?.value ?? 0,
        info: infoResult?.value ?? 0,
      },
    });
  });

  // ── GET /:id — single alert detail ---------------------------------------

  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [alert] = await app.db
      .select()
      .from(alerts)
      .where(
        and(
          eq(alerts.id, id),
          eq(alerts.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!alert) {
      throw notFound('Alert not found');
    }

    // Fetch related entity details
    let unitDetail = null;
    let trackerDetail = null;
    let gatewayDetail = null;
    let fenceDetail = null;

    if (alert.unitId) {
      const [u] = await app.db
        .select({
          id: units.id,
          stockNumber: units.stockNumber,
          make: units.make,
          model: units.model,
          year: units.year,
        })
        .from(units)
        .where(eq(units.id, alert.unitId))
        .limit(1);
      unitDetail = u ?? null;
    }

    if (alert.trackerId) {
      const [t] = await app.db
        .select({
          id: trackers.id,
          deviceEui: trackers.deviceEui,
          label: trackers.label,
          batteryPct: trackers.batteryPct,
        })
        .from(trackers)
        .where(eq(trackers.id, alert.trackerId))
        .limit(1);
      trackerDetail = t ?? null;
    }

    if (alert.gatewayId) {
      const [g] = await app.db
        .select({
          id: gateways.id,
          gatewayEui: gateways.gatewayEui,
          name: gateways.name,
        })
        .from(gateways)
        .where(eq(gateways.id, alert.gatewayId))
        .limit(1);
      gatewayDetail = g ?? null;
    }

    if (alert.geoFenceId) {
      const [f] = await app.db
        .select({
          id: geoFences.id,
          name: geoFences.name,
          fenceType: geoFences.fenceType,
        })
        .from(geoFences)
        .where(eq(geoFences.id, alert.geoFenceId))
        .limit(1);
      fenceDetail = f ?? null;
    }

    return reply.status(200).send({
      data: {
        ...alert,
        unit: unitDetail,
        tracker: trackerDetail,
        gateway: gatewayDetail,
        geo_fence: fenceDetail,
      },
    });
  });

  // ── POST /:id/acknowledge — acknowledge alert ----------------------------

  app.post('/:id/acknowledge', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [existing] = await app.db
      .select({ id: alerts.id, status: alerts.status })
      .from(alerts)
      .where(
        and(
          eq(alerts.id, id),
          eq(alerts.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('Alert not found');
    }

    if (existing.status === AlertStatus.ACKNOWLEDGED) {
      throw badRequest('Alert is already acknowledged');
    }

    const [updated] = await app.db
      .update(alerts)
      .set({
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedBy: request.user.sub,
        acknowledgedAt: new Date(),
      })
      .where(eq(alerts.id, id))
      .returning();

    return reply.status(200).send({ data: updated });
  });

  // ── POST /:id/dismiss — dismiss alert ------------------------------------

  app.post('/:id/dismiss', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [existing] = await app.db
      .select({ id: alerts.id })
      .from(alerts)
      .where(
        and(
          eq(alerts.id, id),
          eq(alerts.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('Alert not found');
    }

    const [updated] = await app.db
      .update(alerts)
      .set({ status: AlertStatus.DISMISSED })
      .where(eq(alerts.id, id))
      .returning();

    return reply.status(200).send({ data: updated });
  });

  // ── POST /:id/snooze — snooze alert --------------------------------------

  app.post('/:id/snooze', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = snoozeAlertSchema.parse(request.body);

    const [existing] = await app.db
      .select({ id: alerts.id })
      .from(alerts)
      .where(
        and(
          eq(alerts.id, id),
          eq(alerts.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('Alert not found');
    }

    const durationMs = SNOOZE_DURATIONS[body.duration];
    if (!durationMs) {
      throw badRequest(`Invalid snooze duration: ${body.duration}. Must be one of: 1h, 4h, 24h`);
    }
    const snoozedUntil = new Date(Date.now() + durationMs);

    const [updated] = await app.db
      .update(alerts)
      .set({
        status: AlertStatus.SNOOZED,
        snoozedUntil,
      })
      .where(eq(alerts.id, id))
      .returning();

    return reply.status(200).send({ data: updated });
  });

  // ── POST /bulk-acknowledge — acknowledge multiple alerts -----------------

  app.post('/bulk-acknowledge', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = bulkAcknowledgeSchema.parse(request.body);

    // Single UPDATE instead of N SELECT + N UPDATE queries
    const updatedRows = await app.db
      .update(alerts)
      .set({
        status: AlertStatus.ACKNOWLEDGED,
        acknowledgedBy: request.user.sub,
        acknowledgedAt: new Date(),
      })
      .where(
        and(
          inArray(alerts.id, body.alert_ids),
          eq(alerts.dealershipId, request.dealershipId),
          ne(alerts.status, AlertStatus.ACKNOWLEDGED),
        ),
      )
      .returning({ id: alerts.id });

    return reply.status(200).send({
      data: {
        requested: body.alert_ids.length,
        acknowledged: updatedRows.length,
      },
    });
  });
}
