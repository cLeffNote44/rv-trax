// ---------------------------------------------------------------------------
// RV Trax API — Staff Activity routes
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, count, sql } from 'drizzle-orm';
import { staffActivityLog } from '@rv-trax/db';
import { paginationSchema } from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { decodeCursor, buildPaginatedResponse } from '../utils/pagination.js';

export default async function staffActivityRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── GET / — paginated activity feed ----------------------------------------

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    const { limit, cursor } = paginationSchema.parse(query);

    const conditions = [eq(staffActivityLog.dealershipId, request.dealershipId)];

    if (query['user_id']) {
      conditions.push(eq(staffActivityLog.userId, query['user_id']));
    }
    if (query['action']) {
      conditions.push(eq(staffActivityLog.action, query['action']));
    }
    if (query['entity_type']) {
      conditions.push(eq(staffActivityLog.entityType, query['entity_type']));
    }

    const decodedCursor = decodeCursor(cursor);
    if (decodedCursor) {
      conditions.push(sql`${staffActivityLog.createdAt} < ${decodedCursor}`);
    }

    const rows = await app.db
      .select()
      .from(staffActivityLog)
      .where(and(...conditions))
      .orderBy(desc(staffActivityLog.createdAt))
      .limit(limit + 1);

    return reply.send(buildPaginatedResponse(rows, limit, cursor));
  });

  // ── GET /stats — staff efficiency metrics ----------------------------------

  app.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    const days = parseInt(query['days'] ?? '7', 10);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Actions per user
    const perUser = await app.db
      .select({
        userId: staffActivityLog.userId,
        actionCount: count(staffActivityLog.id),
      })
      .from(staffActivityLog)
      .where(
        and(
          eq(staffActivityLog.dealershipId, request.dealershipId),
          sql`${staffActivityLog.createdAt} >= ${since.toISOString()}`,
        ),
      )
      .groupBy(staffActivityLog.userId)
      .orderBy(desc(count(staffActivityLog.id)));

    // Actions by type
    const byAction = await app.db
      .select({
        action: staffActivityLog.action,
        actionCount: count(staffActivityLog.id),
      })
      .from(staffActivityLog)
      .where(
        and(
          eq(staffActivityLog.dealershipId, request.dealershipId),
          sql`${staffActivityLog.createdAt} >= ${since.toISOString()}`,
        ),
      )
      .groupBy(staffActivityLog.action)
      .orderBy(desc(count(staffActivityLog.id)));

    // Total today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [todayResult] = await app.db
      .select({ total: count(staffActivityLog.id) })
      .from(staffActivityLog)
      .where(
        and(
          eq(staffActivityLog.dealershipId, request.dealershipId),
          sql`${staffActivityLog.createdAt} >= ${today.toISOString()}`,
        ),
      );

    return reply.send({
      data: {
        per_user: perUser,
        by_action: byAction,
        actions_today: todayResult?.total ?? 0,
        days,
      },
    });
  });
}
