// ---------------------------------------------------------------------------
// RV Trax API — Gateway routes (GET/POST/PATCH/DELETE /api/v1/gateways)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, gte, count } from 'drizzle-orm';
import { gateways, gatewayTelemetry } from '@rv-trax/db';
import {
  AuditAction,
  GatewayStatus,
  createGatewaySchema,
  updateGatewaySchema,
} from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, badRequest, conflict } from '../utils/errors.js';
import { logAction } from '../services/audit.js';
import { sql } from 'drizzle-orm';

// ── Gateway offline threshold (5 minutes) ----------------------------------

const GATEWAY_OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

export default async function gatewayRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth + tenant
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── GET / — list gateways for dealership -----------------------------------

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const rows = await app.db
      .select()
      .from(gateways)
      .where(eq(gateways.dealershipId, request.dealershipId))
      .orderBy(desc(gateways.createdAt));

    return reply.status(200).send({ data: rows });
  });

  // ── GET /:id — gateway detail with recent telemetry ------------------------

  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [gateway] = await app.db
      .select()
      .from(gateways)
      .where(
        and(
          eq(gateways.id, id),
          eq(gateways.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!gateway) {
      throw notFound('Gateway not found');
    }

    // Fetch last 10 telemetry records
    const recentTelemetry = await app.db
      .select()
      .from(gatewayTelemetry)
      .where(eq(gatewayTelemetry.gatewayId, id))
      .orderBy(desc(gatewayTelemetry.time))
      .limit(10);

    return reply.status(200).send({
      data: {
        ...gateway,
        recent_telemetry: recentTelemetry,
      },
    });
  });

  // ── POST / — register gateway ----------------------------------------------

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createGatewaySchema.parse(request.body);

    // Check for duplicate gateway_eui
    const existing = await app.db
      .select({ id: gateways.id })
      .from(gateways)
      .where(eq(gateways.gatewayEui, body.gateway_eui))
      .limit(1);

    if (existing.length > 0) {
      throw conflict(`Gateway with EUI "${body.gateway_eui}" already exists`);
    }

    const [gateway] = await app.db
      .insert(gateways)
      .values({
        dealershipId: request.dealershipId,
        gatewayEui: body.gateway_eui,
        name: body.name ?? null,
        lotId: body.lot_id ?? null,
        backhaulType: body.backhaul_type ?? null,
        latitude: body.latitude?.toString() ?? null,
        longitude: body.longitude?.toString() ?? null,
        status: GatewayStatus.ONLINE,
      })
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.CREATE,
      entityType: 'gateway',
      entityId: gateway!.id,
      ipAddress: request.ip,
    });

    return reply.status(201).send({ data: gateway });
  });

  // ── PATCH /:id — update gateway --------------------------------------------

  app.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateGatewaySchema.parse(request.body);

    const [existing] = await app.db
      .select()
      .from(gateways)
      .where(
        and(
          eq(gateways.id, id),
          eq(gateways.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('Gateway not found');
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates['name'] = body.name;
    if (body.lot_id !== undefined) updates['lotId'] = body.lot_id;
    if (body.backhaul_type !== undefined) updates['backhaulType'] = body.backhaul_type;
    if (body.latitude !== undefined) updates['latitude'] = String(body.latitude);
    if (body.longitude !== undefined) updates['longitude'] = String(body.longitude);

    if (Object.keys(updates).length === 0) {
      return reply.status(200).send({ data: existing });
    }

    const [updated] = await app.db
      .update(gateways)
      .set(updates)
      .where(eq(gateways.id, id))
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.UPDATE,
      entityType: 'gateway',
      entityId: id,
      changes: body as Record<string, unknown>,
      ipAddress: request.ip,
    });

    return reply.status(200).send({ data: updated });
  });

  // ── DELETE /:id — remove gateway -------------------------------------------

  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [existing] = await app.db
      .select({ id: gateways.id })
      .from(gateways)
      .where(
        and(
          eq(gateways.id, id),
          eq(gateways.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('Gateway not found');
    }

    await app.db.delete(gateways).where(eq(gateways.id, id));

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.DELETE,
      entityType: 'gateway',
      entityId: id,
      ipAddress: request.ip,
    });

    return reply.status(200).send({ message: 'Gateway removed successfully' });
  });

  // ── GET /:id/telemetry — telemetry history ---------------------------------

  app.get('/:id/telemetry', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const query = request.query as { from?: string; to?: string; interval?: string };

    // Verify gateway belongs to dealership
    const [gateway] = await app.db
      .select({ id: gateways.id })
      .from(gateways)
      .where(
        and(
          eq(gateways.id, id),
          eq(gateways.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!gateway) {
      throw notFound('Gateway not found');
    }

    const from = query.from ? new Date(query.from) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = query.to ? new Date(query.to) : new Date();
    const VALID_INTERVALS = [1, 5, 10, 15, 30, 60];
    const intervalMinutes = query.interval ? parseInt(query.interval, 10) : 5;

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      throw badRequest('Invalid date format for "from" or "to" parameter');
    }

    if (!VALID_INTERVALS.includes(intervalMinutes)) {
      throw badRequest(`Invalid interval. Must be one of: ${VALID_INTERVALS.join(', ')}`);
    }

    // For 5-minute aggregates, use time_bucket if available (TimescaleDB),
    // otherwise fall back to date_trunc-based grouping.
    // We use raw SQL since Drizzle doesn't support time_bucket natively.
    const rows = await app.db.execute(sql`
      SELECT
        date_trunc('minute', gt.time) -
          (EXTRACT(MINUTE FROM gt.time)::int % ${intervalMinutes}) * interval '1 minute' AS time,
        AVG(gt.cpu_temp_c::numeric)::numeric(5,1) AS cpu_temp,
        AVG(gt.memory_used_pct::numeric)::numeric(5,1) AS memory_used_pct,
        AVG(gt.backhaul_latency_ms::numeric)::numeric(7,1) AS backhaul_latency_ms,
        SUM(gt.packets_received)::int AS packets_received,
        SUM(gt.packets_forwarded)::int AS packets_forwarded
      FROM gateway_telemetry gt
      WHERE gt.gateway_id = ${id}
        AND gt.time >= ${from.toISOString()}
        AND gt.time <= ${to.toISOString()}
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 500
    `);

    return reply.status(200).send({ data: rows });
  });

  // ── GET /:id/health — computed health score --------------------------------

  app.get('/:id/health', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [gateway] = await app.db
      .select()
      .from(gateways)
      .where(
        and(
          eq(gateways.id, id),
          eq(gateways.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!gateway) {
      throw notFound('Gateway not found');
    }

    // Determine online/offline status based on last_seen_at
    const isOnline = gateway.lastSeenAt
      ? Date.now() - gateway.lastSeenAt.getTime() < GATEWAY_OFFLINE_THRESHOLD_MS
      : false;

    // Calculate uptime over the last 24 hours:
    // Count telemetry records in last 24h vs. expected (1 per minute = 1440)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [telemetryCount] = await app.db
      .select({ value: count() })
      .from(gatewayTelemetry)
      .where(
        and(
          eq(gatewayTelemetry.gatewayId, id),
          gte(gatewayTelemetry.time, twentyFourHoursAgo),
        ),
      );

    const recordCount = telemetryCount?.value ?? 0;
    // Assume 1 record per minute = 1440 expected in 24h
    const uptimePct = Math.min(100, Math.round((Number(recordCount) / 1440) * 100 * 10) / 10);

    // Average latency from last 24h
    const [latencyResult] = await app.db.execute(sql`
      SELECT
        AVG(gt.backhaul_latency_ms::numeric)::numeric(7,1) AS avg_latency
      FROM gateway_telemetry gt
      WHERE gt.gateway_id = ${id}
        AND gt.time >= ${twentyFourHoursAgo.toISOString()}
    `) as unknown as [{ avg_latency: string | null }];

    // Packet loss: (packets_received - packets_forwarded) / packets_received
    const [packetResult] = await app.db.execute(sql`
      SELECT
        COALESCE(SUM(gt.packets_received), 0)::int AS total_received,
        COALESCE(SUM(gt.packets_forwarded), 0)::int AS total_forwarded
      FROM gateway_telemetry gt
      WHERE gt.gateway_id = ${id}
        AND gt.time >= ${twentyFourHoursAgo.toISOString()}
    `) as unknown as [{ total_received: number; total_forwarded: number }];

    const totalReceived = Number(packetResult?.total_received ?? 0);
    const totalForwarded = Number(packetResult?.total_forwarded ?? 0);
    const packetLossPct = totalReceived > 0
      ? Math.round(((totalReceived - totalForwarded) / totalReceived) * 100 * 10) / 10
      : 0;

    return reply.status(200).send({
      data: {
        status: isOnline ? 'online' : 'offline',
        uptime_pct: uptimePct,
        avg_latency: latencyResult?.avg_latency ? parseFloat(latencyResult.avg_latency) : null,
        packet_loss_pct: packetLossPct,
        last_seen: gateway.lastSeenAt?.toISOString() ?? null,
      },
    });
  });
}
