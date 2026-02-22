// ---------------------------------------------------------------------------
// RV Trax API — Admin routes (GET/POST /api/v1/admin)
// Internal admin routes for RV Trax staff, authenticated via X-Admin-Token.
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, ilike, and, gt, count, sql, inArray } from 'drizzle-orm';
import {
  dealerships,
  units,
  lots,
  users,
  trackers,
  gateways,
  featureFlags,
} from '@rv-trax/db';
import {
  adminDealershipQuerySchema,
  setFeatureFlagSchema,
  AuditAction,
} from '@rv-trax/shared';
import { notFound } from '../utils/errors.js';
import { decodeCursor, buildPaginatedResponse } from '../utils/pagination.js';
import { logAction } from '../services/audit.js';
import crypto from 'node:crypto';

// ── Admin token middleware ──────────────────────────────────────────────────

async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = request.headers['x-admin-token'] as string | undefined;
  const adminToken = process.env['ADMIN_API_TOKEN'];

  if (!adminToken || !token) {
    return reply.status(403).send({
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required',
      },
    });
  }

  // Timing-safe comparison to prevent timing attacks
  const tokenBuf = Buffer.from(token, 'utf-8');
  const adminBuf = Buffer.from(adminToken, 'utf-8');

  if (tokenBuf.length !== adminBuf.length || !crypto.timingSafeEqual(tokenBuf, adminBuf)) {
    return reply.status(403).send({
      error: {
        code: 'FORBIDDEN',
        message: 'Admin access required',
      },
    });
  }
}

export default async function adminRoutes(app: FastifyInstance): Promise<void> {
  // All admin routes require the admin token
  app.addHook('preHandler', requireAdmin);

  // ── GET /dealerships — list all dealerships with usage stats ─────────────

  app.get('/dealerships', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    const parsed = adminDealershipQuerySchema.parse(query);

    const conditions: ReturnType<typeof eq>[] = [];

    if (parsed.status) {
      conditions.push(eq(dealerships.subscriptionStatus, parsed.status));
    }

    if (parsed.tier) {
      conditions.push(eq(dealerships.subscriptionTier, parsed.tier));
    }

    if (parsed.search) {
      conditions.push(ilike(dealerships.name, `%${parsed.search}%`));
    }

    if (parsed.cursor) {
      const decodedId = decodeCursor(parsed.cursor);
      conditions.push(gt(dealerships.id, decodedId));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    // Get dealerships with unit counts via a subquery approach
    const rows = await app.db
      .select({
        id: dealerships.id,
        name: dealerships.name,
        city: dealerships.city,
        state: dealerships.state,
        subscriptionTier: dealerships.subscriptionTier,
        subscriptionStatus: dealerships.subscriptionStatus,
        stripeCustomerId: dealerships.stripeCustomerId,
        createdAt: dealerships.createdAt,
        updatedAt: dealerships.updatedAt,
      })
      .from(dealerships)
      .where(where)
      .orderBy(dealerships.createdAt)
      .limit(parsed.limit + 1);

    // Get unit counts in a single GROUP BY query instead of N+1
    const dealershipIds = rows.map((r) => r.id);
    const unitCounts: Record<string, number> = {};

    if (dealershipIds.length > 0) {
      const unitCountRows = await app.db
        .select({
          dealershipId: units.dealershipId,
          value: count(),
        })
        .from(units)
        .where(inArray(units.dealershipId, dealershipIds))
        .groupBy(units.dealershipId);

      for (const row of unitCountRows) {
        unitCounts[row.dealershipId] = row.value;
      }
    }

    // Get total count without cursor filter
    const countConditions: ReturnType<typeof eq>[] = [];
    if (parsed.status) {
      countConditions.push(eq(dealerships.subscriptionStatus, parsed.status));
    }
    if (parsed.tier) {
      countConditions.push(eq(dealerships.subscriptionTier, parsed.tier));
    }
    if (parsed.search) {
      countConditions.push(ilike(dealerships.name, `%${parsed.search}%`));
    }

    const countWhere = countConditions.length > 0 ? and(...countConditions) : undefined;

    const [totalResult] = await app.db
      .select({ value: count() })
      .from(dealerships)
      .where(countWhere);

    const totalCount = totalResult?.value ?? 0;

    const enrichedRows = rows.map((row) => ({
      ...row,
      unitCount: unitCounts[row.id] ?? 0,
    }));

    return reply.status(200).send(buildPaginatedResponse(enrichedRows, parsed.limit, totalCount));
  });

  // ── GET /dealerships/:id — dealership detail with full stats ────────────

  app.get('/dealerships/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [dealership] = await app.db
      .select()
      .from(dealerships)
      .where(eq(dealerships.id, id))
      .limit(1);

    if (!dealership) {
      throw notFound('Dealership not found');
    }

    // Gather all counts in parallel
    const [unitCountResult] = await app.db
      .select({ value: count() })
      .from(units)
      .where(eq(units.dealershipId, id));

    const [lotCountResult] = await app.db
      .select({ value: count() })
      .from(lots)
      .where(eq(lots.dealershipId, id));

    const [userCountResult] = await app.db
      .select({ value: count() })
      .from(users)
      .where(eq(users.dealershipId, id));

    const [trackerCountResult] = await app.db
      .select({ value: count() })
      .from(trackers)
      .where(eq(trackers.dealershipId, id));

    const [gatewayCountResult] = await app.db
      .select({ value: count() })
      .from(gateways)
      .where(eq(gateways.dealershipId, id));

    return reply.status(200).send({
      data: {
        ...dealership,
        counts: {
          units: unitCountResult?.value ?? 0,
          lots: lotCountResult?.value ?? 0,
          users: userCountResult?.value ?? 0,
          trackers: trackerCountResult?.value ?? 0,
          gateways: gatewayCountResult?.value ?? 0,
        },
      },
    });
  });

  // ── POST /dealerships/:id/impersonate — generate temp JWT ──────────────

  app.post(
    '/dealerships/:id/impersonate',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const [dealership] = await app.db
        .select({ id: dealerships.id, name: dealerships.name })
        .from(dealerships)
        .where(eq(dealerships.id, id))
        .limit(1);

      if (!dealership) {
        throw notFound('Dealership not found');
      }

      // Generate a temporary JWT for the dealership with admin identity
      const impersonationToken = app.jwt.sign(
        {
          sub: 'admin-impersonation',
          dealershipId: dealership.id,
          role: 'owner' as const,
        },
        { expiresIn: '1h' },
      );

      // Audit log the impersonation
      await logAction(app.db, {
        dealershipId: dealership.id,
        userId: null,
        action: AuditAction.LOGIN,
        entityType: 'admin_impersonation',
        entityId: dealership.id,
        changes: { admin_action: 'impersonate', dealership_name: dealership.name },
        ipAddress: request.ip,
      });

      app.log.info(
        { dealershipId: dealership.id, dealershipName: dealership.name },
        'Admin impersonation token generated',
      );

      return reply.status(200).send({
        data: {
          token: impersonationToken,
          dealership_id: dealership.id,
          dealership_name: dealership.name,
          expires_in: 3600,
        },
      });
    },
  );

  // ── POST /dealerships/:id/feature-flags — set feature flag ─────────────

  app.post(
    '/dealerships/:id/feature-flags',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = setFeatureFlagSchema.parse(request.body);

      // Verify dealership exists
      const [dealership] = await app.db
        .select({ id: dealerships.id })
        .from(dealerships)
        .where(eq(dealerships.id, id))
        .limit(1);

      if (!dealership) {
        throw notFound('Dealership not found');
      }

      // Check if flag exists
      const [existing] = await app.db
        .select({ id: featureFlags.id })
        .from(featureFlags)
        .where(
          and(
            eq(featureFlags.dealershipId, id),
            eq(featureFlags.feature, body.feature),
          ),
        )
        .limit(1);

      if (existing) {
        await app.db
          .update(featureFlags)
          .set({
            enabled: body.enabled,
            updatedAt: new Date(),
          })
          .where(eq(featureFlags.id, existing.id));
      } else {
        await app.db.insert(featureFlags).values({
          dealershipId: id,
          feature: body.feature,
          enabled: body.enabled,
        });
      }

      await logAction(app.db, {
        dealershipId: id,
        userId: null,
        action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
        entityType: 'feature_flag',
        entityId: body.feature,
        changes: {
          admin_action: 'set_feature_flag',
          feature: body.feature,
          enabled: body.enabled,
        },
        ipAddress: request.ip,
      });

      return reply.status(200).send({
        data: {
          dealership_id: id,
          feature: body.feature,
          enabled: body.enabled,
        },
      });
    },
  );

  // ── GET /system/health — system health check ───────────────────────────

  app.get('/system/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    const health: {
      database: { status: string; latency_ms?: number; error?: string };
      redis: { status: string; latency_ms?: number; error?: string };
    } = {
      database: { status: 'unknown' },
      redis: { status: 'unknown' },
    };

    // Check database
    const dbStart = Date.now();
    try {
      await app.db.execute(sql`SELECT 1`);
      health.database = {
        status: 'healthy',
        latency_ms: Date.now() - dbStart,
      };
    } catch (err) {
      health.database = {
        status: 'unhealthy',
        latency_ms: Date.now() - dbStart,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }

    // Check Redis
    const redisStart = Date.now();
    try {
      const pong = await app.redis.ping();
      health.redis = {
        status: pong === 'PONG' ? 'healthy' : 'degraded',
        latency_ms: Date.now() - redisStart,
      };
    } catch (err) {
      health.redis = {
        status: 'unhealthy',
        latency_ms: Date.now() - redisStart,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }

    const overallStatus =
      health.database.status === 'healthy' && health.redis.status === 'healthy'
        ? 'healthy'
        : 'degraded';

    return reply.status(overallStatus === 'healthy' ? 200 : 503).send({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: health,
    });
  });

  // ── GET /system/stats — global statistics ──────────────────────────────

  app.get('/system/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    const [dealershipCount] = await app.db
      .select({ value: count() })
      .from(dealerships);

    const [unitCount] = await app.db
      .select({ value: count() })
      .from(units);

    const [userCount] = await app.db
      .select({ value: count() })
      .from(users);

    const [trackerCount] = await app.db
      .select({ value: count() })
      .from(trackers);

    const [gatewayCount] = await app.db
      .select({ value: count() })
      .from(gateways);

    // Check for active WebSocket connections count via Redis (if stored there)
    let activeConnections = 0;
    try {
      const connCount = await app.redis.get('ws:active_connections');
      activeConnections = connCount ? parseInt(connCount, 10) : 0;
    } catch {
      // Redis key may not exist; default to 0
    }

    return reply.status(200).send({
      data: {
        dealerships: dealershipCount?.value ?? 0,
        units: unitCount?.value ?? 0,
        users: userCount?.value ?? 0,
        trackers: trackerCount?.value ?? 0,
        gateways: gatewayCount?.value ?? 0,
        active_websocket_connections: activeConnections,
        timestamp: new Date().toISOString(),
      },
    });
  });
}
