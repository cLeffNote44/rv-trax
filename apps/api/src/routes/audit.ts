// ---------------------------------------------------------------------------
// RV Trax API — Audit log routes (GET /api/v1/audit-log)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, gte, lte, count, desc, gt } from 'drizzle-orm';
import { auditLog } from '@rv-trax/db';
import { paginationSchema } from '@rv-trax/shared';
import { UserRole } from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { decodeCursor, buildPaginatedResponse } from '../utils/pagination.js';

export default async function auditRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth + tenant + manager or owner role
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);
  app.addHook('preHandler', app.requireRole(UserRole.OWNER, UserRole.MANAGER));

  // ── GET / — list audit entries ---------------------------------------------

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    const { limit, cursor } = paginationSchema.parse(query);

    const conditions = [eq(auditLog.dealershipId, request.dealershipId)];

    if (query['entity_type']) {
      conditions.push(eq(auditLog.entityType, query['entity_type']));
    }

    if (query['entity_id']) {
      conditions.push(eq(auditLog.entityId, query['entity_id']));
    }

    if (query['user_id']) {
      conditions.push(eq(auditLog.userId, query['user_id']));
    }

    if (query['action']) {
      conditions.push(eq(auditLog.action, query['action']));
    }

    if (query['from']) {
      conditions.push(gte(auditLog.createdAt, new Date(query['from'])));
    }

    if (query['to']) {
      conditions.push(lte(auditLog.createdAt, new Date(query['to'])));
    }

    if (cursor) {
      const decodedId = decodeCursor(cursor);
      conditions.push(gt(auditLog.id, decodedId));
    }

    const where = and(...conditions);

    // Get total count
    const [countResult] = await app.db
      .select({ value: count() })
      .from(auditLog)
      .where(where);

    const totalCount = countResult?.value ?? 0;

    const rows = await app.db
      .select()
      .from(auditLog)
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit + 1);

    return reply.status(200).send(buildPaginatedResponse(rows, limit, totalCount));
  });
}
