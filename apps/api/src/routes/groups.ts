// ---------------------------------------------------------------------------
// RV Trax API — Dealership group management routes (GET/POST /api/v1/groups)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, ilike, or, gt, count, inArray, isNull } from 'drizzle-orm';
import {
  dealerships,
  dealershipGroups,
  units,
  lots,
  users,
} from '@rv-trax/db';
import { AuditAction, UserRole } from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, forbidden, badRequest } from '../utils/errors.js';
import { decodeCursor, buildPaginatedResponse } from '../utils/pagination.js';
import { logAction } from '../services/audit.js';
import { getGroupAnalytics } from '../services/group-analytics.js';
import { z } from 'zod';

// ── Module augmentation for groupId -----------------------------------------

declare module 'fastify' {
  interface FastifyRequest {
    groupId: string;
  }
}

// ── Local schemas -----------------------------------------------------------

const createGroupSchema = z.object({
  name: z.string().min(1, 'Group name is required'),
});

const addDealershipSchema = z.object({
  dealership_id: z.string().uuid(),
});

const removeDealershipSchema = z.object({
  dealership_id: z.string().uuid(),
});

const groupUnitSearchSchema = z.object({
  q: z.string().optional(),
  status: z.string().optional(),
  unit_type: z.string().optional(),
  make: z.string().optional(),
  dealership_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

// ── Group membership middleware ---------------------------------------------

async function requireGroupMember(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const db = request.server.db;

  const [dealership] = await db
    .select({ groupId: dealerships.groupId })
    .from(dealerships)
    .where(eq(dealerships.id, request.dealershipId))
    .limit(1);

  if (!dealership) {
    throw notFound('Dealership not found');
  }

  if (!dealership.groupId) {
    throw forbidden('Dealership is not part of a group');
  }

  request.groupId = dealership.groupId;
}

// ── Route registration -------------------------------------------------------

export default async function groupRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth + tenant
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── POST / — create a new group -------------------------------------------

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createGroupSchema.parse(request.body);

    // Check that current dealership is not already in a group
    const [currentDealership] = await app.db
      .select({ id: dealerships.id, groupId: dealerships.groupId })
      .from(dealerships)
      .where(eq(dealerships.id, request.dealershipId))
      .limit(1);

    if (!currentDealership) {
      throw notFound('Dealership not found');
    }

    if (currentDealership.groupId) {
      throw badRequest('Dealership is already part of a group');
    }

    // Create the group
    const [group] = await app.db
      .insert(dealershipGroups)
      .values({ name: body.name })
      .returning();

    // Assign current dealership to the group
    await app.db
      .update(dealerships)
      .set({ groupId: group!.id, updatedAt: new Date() })
      .where(eq(dealerships.id, request.dealershipId));

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.CREATE,
      entityType: 'dealership_group',
      entityId: group!.id,
      ipAddress: request.ip,
    });

    return reply.status(201).send({ data: group });
  });

  // ── GET / — get group info -------------------------------------------------

  app.get(
    '/',
    { preHandler: [requireGroupMember] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const [group] = await app.db
        .select()
        .from(dealershipGroups)
        .where(eq(dealershipGroups.id, request.groupId))
        .limit(1);

      if (!group) {
        throw notFound('Group not found');
      }

      // Get all member dealerships
      const members = await app.db
        .select({
          id: dealerships.id,
          name: dealerships.name,
          city: dealerships.city,
          state: dealerships.state,
        })
        .from(dealerships)
        .where(eq(dealerships.groupId, request.groupId))
        .orderBy(dealerships.name);

      return reply.status(200).send({
        data: {
          ...group,
          dealerships: members,
        },
      });
    },
  );

  // ── GET /dealerships — list all dealerships in group with counts -----------

  app.get(
    '/dealerships',
    { preHandler: [requireGroupMember] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const groupDealerships = await app.db
        .select()
        .from(dealerships)
        .where(eq(dealerships.groupId, request.groupId))
        .orderBy(dealerships.name);

      const dealershipIds = groupDealerships.map((d) => d.id);

      if (dealershipIds.length === 0) {
        return reply.status(200).send({ data: [] });
      }

      // Count units per dealership
      const unitCounts = await app.db
        .select({
          dealershipId: units.dealershipId,
          cnt: count(),
        })
        .from(units)
        .where(inArray(units.dealershipId, dealershipIds))
        .groupBy(units.dealershipId);

      const unitCountMap = new Map(
        unitCounts.map((r) => [r.dealershipId, r.cnt]),
      );

      // Count lots per dealership
      const lotCounts = await app.db
        .select({
          dealershipId: lots.dealershipId,
          cnt: count(),
        })
        .from(lots)
        .where(inArray(lots.dealershipId, dealershipIds))
        .groupBy(lots.dealershipId);

      const lotCountMap = new Map(
        lotCounts.map((r) => [r.dealershipId, r.cnt]),
      );

      // Count users per dealership
      const userCounts = await app.db
        .select({
          dealershipId: users.dealershipId,
          cnt: count(),
        })
        .from(users)
        .where(inArray(users.dealershipId, dealershipIds))
        .groupBy(users.dealershipId);

      const userCountMap = new Map(
        userCounts.map((r) => [r.dealershipId, r.cnt]),
      );

      const result = groupDealerships.map((d) => ({
        ...d,
        unitCount: unitCountMap.get(d.id) ?? 0,
        lotCount: lotCountMap.get(d.id) ?? 0,
        userCount: userCountMap.get(d.id) ?? 0,
      }));

      return reply.status(200).send({ data: result });
    },
  );

  // ── GET /analytics — aggregate analytics across all group dealerships ------

  app.get(
    '/analytics',
    { preHandler: [requireGroupMember] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const analytics = await getGroupAnalytics(app.db, request.groupId);
      return reply.status(200).send({ data: analytics });
    },
  );

  // ── GET /units/search — cross-location unit search -------------------------

  app.get(
    '/units/search',
    { preHandler: [requireGroupMember] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = groupUnitSearchSchema.parse(request.query);

      // Get all dealership IDs in the group
      const groupDealerships = await app.db
        .select({ id: dealerships.id, name: dealerships.name })
        .from(dealerships)
        .where(eq(dealerships.groupId, request.groupId));

      const dealershipIds = groupDealerships.map((d) => d.id);

      if (dealershipIds.length === 0) {
        return reply.status(200).send({
          data: [],
          pagination: { next_cursor: null, has_more: false, total_count: 0 },
        });
      }

      const dealershipNameMap = new Map(
        groupDealerships.map((d) => [d.id, d.name]),
      );

      // Build conditions
      const conditions = [
        inArray(units.dealershipId, dealershipIds),
        isNull(units.archivedAt),
      ];

      // Filter to a specific dealership within the group
      if (query.dealership_id) {
        if (!dealershipIds.includes(query.dealership_id)) {
          throw badRequest('Dealership is not part of this group');
        }
        conditions.push(eq(units.dealershipId, query.dealership_id));
      }

      // Free text search
      if (query.q) {
        const term = `%${query.q}%`;
        conditions.push(
          or(
            ilike(units.stockNumber, term),
            ilike(units.vin, term),
            ilike(units.make, term),
            ilike(units.model, term),
          )!,
        );
      }

      // Status filter
      if (query.status) {
        conditions.push(eq(units.status, query.status));
      }

      // Unit type filter
      if (query.unit_type) {
        conditions.push(eq(units.unitType, query.unit_type));
      }

      // Make filter
      if (query.make) {
        conditions.push(ilike(units.make, query.make));
      }

      // Cursor
      if (query.cursor) {
        const decodedId = decodeCursor(query.cursor);
        conditions.push(gt(units.id, decodedId));
      }

      const where = and(...conditions);

      // Total count
      const [countResult] = await app.db
        .select({ value: count() })
        .from(units)
        .where(where);

      const totalCount = countResult?.value ?? 0;

      // Fetch rows
      const rows = await app.db
        .select()
        .from(units)
        .where(where)
        .orderBy(units.createdAt)
        .limit(query.limit + 1);

      // Attach dealership name to each result
      const enrichedRows = rows.map((row) => ({
        ...row,
        dealershipName: dealershipNameMap.get(row.dealershipId) ?? 'Unknown',
      }));

      return reply
        .status(200)
        .send(buildPaginatedResponse(enrichedRows, query.limit, totalCount));
    },
  );

  // ── POST /add-dealership — add a dealership to the group -------------------

  app.post(
    '/add-dealership',
    {
      preHandler: [
        requireGroupMember,
        app.requireRole(UserRole.OWNER, UserRole.MANAGER),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = addDealershipSchema.parse(request.body);

      // Verify target dealership exists
      const [target] = await app.db
        .select({ id: dealerships.id, groupId: dealerships.groupId })
        .from(dealerships)
        .where(eq(dealerships.id, body.dealership_id))
        .limit(1);

      if (!target) {
        throw notFound('Target dealership not found');
      }

      if (target.groupId) {
        throw badRequest('Target dealership is already part of a group');
      }

      // Add to group
      await app.db
        .update(dealerships)
        .set({ groupId: request.groupId, updatedAt: new Date() })
        .where(eq(dealerships.id, body.dealership_id));

      await logAction(app.db, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: AuditAction.UPDATE,
        entityType: 'dealership_group',
        entityId: request.groupId,
        changes: { added_dealership: body.dealership_id },
        ipAddress: request.ip,
      });

      return reply.status(200).send({
        message: 'Dealership added to group successfully',
      });
    },
  );

  // ── POST /remove-dealership — remove a dealership from the group -----------

  app.post(
    '/remove-dealership',
    {
      preHandler: [
        requireGroupMember,
        app.requireRole(UserRole.OWNER, UserRole.MANAGER),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = removeDealershipSchema.parse(request.body);

      // Cannot remove self from group via this route
      if (body.dealership_id === request.dealershipId) {
        throw badRequest('Cannot remove your own dealership from the group');
      }

      // Verify target is in the same group
      const [target] = await app.db
        .select({ id: dealerships.id, groupId: dealerships.groupId })
        .from(dealerships)
        .where(eq(dealerships.id, body.dealership_id))
        .limit(1);

      if (!target) {
        throw notFound('Target dealership not found');
      }

      if (target.groupId !== request.groupId) {
        throw badRequest('Target dealership is not part of this group');
      }

      // Remove from group
      await app.db
        .update(dealerships)
        .set({ groupId: null, updatedAt: new Date() })
        .where(eq(dealerships.id, body.dealership_id));

      await logAction(app.db, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: AuditAction.UPDATE,
        entityType: 'dealership_group',
        entityId: request.groupId,
        changes: { removed_dealership: body.dealership_id },
        ipAddress: request.ip,
      });

      return reply.status(200).send({
        message: 'Dealership removed from group successfully',
      });
    },
  );
}
