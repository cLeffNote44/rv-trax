// ---------------------------------------------------------------------------
// RV Trax API — Analytics routes (GET /api/v1/analytics/*)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, count, gte } from 'drizzle-orm';
import { complianceSnapshots, movementEvents } from '@rv-trax/db';
import { enforceTenant } from '../middleware/tenant.js';
import { z } from 'zod';
import {
  getInventoryAnalytics,
  getLotUtilization,
  getMovementAnalytics,
  getStagingEffectiveness,
} from '../services/analytics.js';

// ── Local query schema ----------------------------------------------------

const analyticsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  lot_id: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export default async function analyticsRoutes(
  app: FastifyInstance,
): Promise<void> {
  // All routes require auth + tenant
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── GET /inventory — inventory analytics (composition, aging, turn rate)

  app.get(
    '/inventory',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = analyticsQuerySchema.parse(request.query);

      const data = await getInventoryAnalytics(
        app.db,
        request.dealershipId,
        query.from,
        query.to,
      );

      return reply.status(200).send({ data });
    },
  );

  // ── GET /lot-utilization — lot utilization metrics

  app.get(
    '/lot-utilization',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = analyticsQuerySchema.parse(request.query);

      const data = await getLotUtilization(
        app.db,
        request.dealershipId,
        query.lot_id,
      );

      return reply.status(200).send({ data });
    },
  );

  // ── GET /movements — movement analytics (most moved, idle, by day)

  app.get(
    '/movements',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = analyticsQuerySchema.parse(request.query);

      const data = await getMovementAnalytics(
        app.db,
        request.dealershipId,
        query.from,
        query.to,
      );

      return reply.status(200).send({ data });
    },
  );

  // ── GET /staging — staging effectiveness

  app.get(
    '/staging',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = analyticsQuerySchema.parse(request.query);

      const data = await getStagingEffectiveness(
        app.db,
        request.dealershipId,
        query.from,
        query.to,
      );

      return reply.status(200).send({ data });
    },
  );

  // ── GET /dashboard — combined dashboard KPIs

  app.get(
    '/dashboard',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = analyticsQuerySchema.parse(request.query);

      // Fetch inventory analytics
      const inventory = await getInventoryAnalytics(
        app.db,
        request.dealershipId,
        query.from,
        query.to,
      );

      // Fetch lot utilization
      const utilization = await getLotUtilization(
        app.db,
        request.dealershipId,
        query.lot_id,
      );

      // Compute average utilization across all lots
      let lot_utilization_pct = 0;
      if (utilization.length > 0) {
        const totalPct = utilization.reduce(
          (sum, lot) => sum + lot.utilization_pct,
          0,
        );
        lot_utilization_pct =
          Math.round((totalPct / utilization.length) * 100) / 100;
      }

      // Latest compliance score
      const [latestCompliance] = await app.db
        .select({
          scorePct: complianceSnapshots.scorePct,
        })
        .from(complianceSnapshots)
        .where(eq(complianceSnapshots.dealershipId, request.dealershipId))
        .orderBy(desc(complianceSnapshots.snapshotAt))
        .limit(1);

      const compliance_score_pct = latestCompliance
        ? parseFloat(latestCompliance.scorePct)
        : 0;

      // Moves today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [movesTodayRow] = await app.db
        .select({ cnt: count() })
        .from(movementEvents)
        .where(
          and(
            eq(movementEvents.dealershipId, request.dealershipId),
            gte(movementEvents.occurredAt, todayStart),
          ),
        );

      const moves_today = movesTodayRow?.cnt ?? 0;

      // Idle unit count (no moves in 60+ days)
      const movement = await getMovementAnalytics(
        app.db,
        request.dealershipId,
        query.from,
        query.to,
      );

      const idle_unit_count = movement.idle_units.length;

      // Aging over 90: 91_120 + 120_plus
      const aging_over_90 =
        inventory.aging_buckets['91_120'] +
        inventory.aging_buckets['120_plus'];

      return reply.status(200).send({
        data: {
          total_units: inventory.total_units,
          average_age_days: inventory.average_age_days,
          stock_turn_rate: inventory.stock_turn_rate,
          lot_utilization_pct,
          compliance_score_pct,
          moves_today,
          idle_unit_count,
          aging_over_90,
        },
      });
    },
  );
}
