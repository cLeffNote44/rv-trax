// ---------------------------------------------------------------------------
// RV Trax API — Real-time status routes
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { units } from '@rv-trax/db';
import { AuditAction, UnitStatus } from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, badRequest } from '../utils/errors.js';
import { logAction } from '../services/audit.js';
import { roomManager } from '../websocket/server.js';
import { publishToDealership } from '../websocket/server.js';

// ── Validation ---------------------------------------------------------------

const validStatuses = new Set(Object.values(UnitStatus));

export default async function realtimeRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth + tenant
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── GET /api/v1/realtime/stats — WebSocket connection stats ----------------
  // Admin / manager only

  app.get(
    '/stats',
    {
      preHandler: [app.requireRole('owner', 'manager')],
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const stats = roomManager.getStats();

      return reply.status(200).send({
        data: {
          total_connections: stats.totalConnections,
          rooms: stats.roomCount,
          connections_by_dealership: stats.connectionsByRoom,
        },
      });
    },
  );

  // ── POST /api/v1/units/:id/status — Change unit status --------------------
  // Also broadcasts via WebSocket

  app.post(
    '/units/:id/status',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = request.body as { status?: string };

      if (!body.status || !validStatuses.has(body.status as UnitStatus)) {
        throw badRequest(
          `Invalid status. Must be one of: ${Array.from(validStatuses).join(', ')}`,
        );
      }

      const newStatus = body.status as UnitStatus;

      // Verify unit exists and belongs to dealership
      const [unit] = await app.db
        .select({
          id: units.id,
          status: units.status,
          dealershipId: units.dealershipId,
        })
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

      const oldStatus = unit.status;

      if (oldStatus === newStatus) {
        return reply.status(200).send({
          data: { message: 'Status unchanged' },
        });
      }

      // Update in DB
      await app.db
        .update(units)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(units.id, id));

      // Broadcast status change to all WebSocket clients in this dealership
      publishToDealership(app.redis, request.dealershipId, {
        type: 'unit_status_change',
        unit_id: id,
        old_status: oldStatus,
        new_status: newStatus,
        changed_by: request.user.sub,
      });

      // Audit log
      await logAction(app.db, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: AuditAction.STATUS_CHANGE,
        entityType: 'unit',
        entityId: id,
        changes: { old_status: oldStatus, new_status: newStatus },
        ipAddress: request.ip,
      });

      return reply.status(200).send({
        data: {
          unit_id: id,
          old_status: oldStatus,
          new_status: newStatus,
        },
      });
    },
  );
}
