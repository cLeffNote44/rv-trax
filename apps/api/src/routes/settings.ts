// ---------------------------------------------------------------------------
// RV Trax API — Dealership settings routes (GET/PATCH /api/v1/settings)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { dealerships, featureFlags, users } from '@rv-trax/db';
import {
  updateDealershipSettingsSchema,
  setFeatureFlagSchema,
  inviteUserSchema,
  AuditAction,
  UserRole,
} from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, conflict, badRequest } from '../utils/errors.js';
import { logAction } from '../services/audit.js';
import { z } from 'zod';

export default async function settingsRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth + tenant
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── GET / — get dealership settings ─────────────────────────────────────

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const [dealership] = await app.db
      .select({
        id: dealerships.id,
        name: dealerships.name,
        address: dealerships.address,
        city: dealerships.city,
        state: dealerships.state,
        zip: dealerships.zip,
        timezone: dealerships.timezone,
        logoUrl: dealerships.logoUrl,
        settings: dealerships.settings,
      })
      .from(dealerships)
      .where(eq(dealerships.id, request.dealershipId))
      .limit(1);

    if (!dealership) {
      throw notFound('Dealership not found');
    }

    return reply.status(200).send({ data: dealership });
  });

  // ── PATCH / — update dealership settings ────────────────────────────────

  app.patch(
    '/',
    { preHandler: [app.requireRole(UserRole.OWNER, UserRole.MANAGER)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = updateDealershipSettingsSchema.parse(request.body);

      // Verify dealership exists
      const [existing] = await app.db
        .select({ id: dealerships.id })
        .from(dealerships)
        .where(eq(dealerships.id, request.dealershipId))
        .limit(1);

      if (!existing) {
        throw notFound('Dealership not found');
      }

      // Build update object
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (body.name !== undefined) updates['name'] = body.name;
      if (body.address !== undefined) updates['address'] = body.address;
      if (body.city !== undefined) updates['city'] = body.city;
      if (body.state !== undefined) updates['state'] = body.state;
      if (body.zip !== undefined) updates['zip'] = body.zip;
      if (body.timezone !== undefined) updates['timezone'] = body.timezone;
      if (body.logo_url !== undefined) updates['logoUrl'] = body.logo_url;

      const [updated] = await app.db
        .update(dealerships)
        .set(updates)
        .where(eq(dealerships.id, request.dealershipId))
        .returning();

      await logAction(app.db, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: AuditAction.UPDATE,
        entityType: 'dealership',
        entityId: request.dealershipId,
        changes: body as Record<string, unknown>,
        ipAddress: request.ip,
      });

      return reply.status(200).send({ data: updated });
    },
  );

  // ── GET /feature-flags — list feature flags for dealership ──────────────

  app.get('/feature-flags', async (request: FastifyRequest, reply: FastifyReply) => {
    const rows = await app.db
      .select({
        feature: featureFlags.feature,
        enabled: featureFlags.enabled,
      })
      .from(featureFlags)
      .where(eq(featureFlags.dealershipId, request.dealershipId))
      .orderBy(featureFlags.feature);

    return reply.status(200).send({ data: rows });
  });

  // ── POST /feature-flags — set a feature flag (owner only) ──────────────

  app.post(
    '/feature-flags',
    { preHandler: [app.requireRole(UserRole.OWNER)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = setFeatureFlagSchema.parse(request.body);

      // Check if the flag already exists for this dealership
      const [existing] = await app.db
        .select({ id: featureFlags.id })
        .from(featureFlags)
        .where(
          and(
            eq(featureFlags.dealershipId, request.dealershipId),
            eq(featureFlags.feature, body.feature),
          ),
        )
        .limit(1);

      let flagId: string;

      if (existing) {
        // Update existing flag
        await app.db
          .update(featureFlags)
          .set({
            enabled: body.enabled,
            updatedAt: new Date(),
          })
          .where(eq(featureFlags.id, existing.id));
        flagId = existing.id;
      } else {
        // Insert new flag
        const [inserted] = await app.db.insert(featureFlags).values({
          dealershipId: request.dealershipId,
          feature: body.feature,
          enabled: body.enabled,
        }).returning();
        flagId = inserted!.id;
      }

      await logAction(app.db, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
        entityType: 'feature_flag',
        entityId: flagId,
        changes: { feature: body.feature, enabled: body.enabled },
        ipAddress: request.ip,
      });

      return reply.status(200).send({
        data: {
          feature: body.feature,
          enabled: body.enabled,
        },
      });
    },
  );

  // ── GET /users — list all users for dealership ──────────────────────────

  app.get('/users', async (request: FastifyRequest, reply: FastifyReply) => {
    const rows = await app.db
      .select({
        id: users.id,
        dealershipId: users.dealershipId,
        email: users.email,
        name: users.name,
        role: users.role,
        avatarUrl: users.avatarUrl,
        isActive: users.isActive,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(eq(users.dealershipId, request.dealershipId))
      .orderBy(users.name);

    return reply.status(200).send({ data: rows });
  });

  // ── POST /users — invite a new user ─────────────────────────────────────

  app.post(
    '/users',
    { preHandler: [app.requireRole(UserRole.OWNER, UserRole.MANAGER)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = inviteUserSchema.parse(request.body);

      const normalizedEmail = body.email.toLowerCase().trim();

      const [existing] = await app.db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, normalizedEmail))
        .limit(1);

      if (existing) {
        throw conflict('A user with this email already exists');
      }

      const tempPassword = `Temp${randomBytes(8).toString('hex')}!1A`;
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      const [user] = await app.db
        .insert(users)
        .values({
          dealershipId: request.dealershipId,
          email: normalizedEmail,
          name: body.name,
          role: body.role,
          passwordHash,
          invitedBy: request.user.sub,
        })
        .returning({
          id: users.id,
          dealershipId: users.dealershipId,
          email: users.email,
          name: users.name,
          role: users.role,
          isActive: users.isActive,
          createdAt: users.createdAt,
        });

      await logAction(app.db, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: AuditAction.CREATE,
        entityType: 'user',
        entityId: user!.id,
        changes: { email: body.email, role: body.role },
        ipAddress: request.ip,
      });

      return reply.status(201).send({ data: user });
    },
  );

  // ── PATCH /users/:id — update user ──────────────────────────────────────

  const updateUserSchema = z.object({
    name: z.string().min(1).optional(),
    role: z.enum([UserRole.OWNER, UserRole.MANAGER, UserRole.SALES, UserRole.SERVICE, UserRole.PORTER, UserRole.VIEWER]).optional(),
    is_active: z.boolean().optional(),
  });

  app.patch(
    '/users/:id',
    { preHandler: [app.requireRole(UserRole.OWNER, UserRole.MANAGER)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = updateUserSchema.parse(request.body);

      const [existing] = await app.db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(
          and(
            eq(users.id, id),
            eq(users.dealershipId, request.dealershipId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw notFound('User not found');
      }

      // Prevent self-escalation: users cannot change their own role
      if (body.role !== undefined && id === request.user.sub) {
        throw badRequest('Cannot change your own role');
      }

      // Prevent managers from setting role to owner
      if (body.role === UserRole.OWNER && request.user.role !== UserRole.OWNER) {
        throw badRequest('Only owners can assign the owner role');
      }

      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (body.name !== undefined) updates['name'] = body.name;
      if (body.role !== undefined) updates['role'] = body.role;
      if (body.is_active !== undefined) updates['isActive'] = body.is_active;

      if (Object.keys(updates).length <= 1) {
        throw badRequest('No updatable fields provided');
      }

      const [updated] = await app.db
        .update(users)
        .set(updates)
        .where(eq(users.id, id))
        .returning({
          id: users.id,
          dealershipId: users.dealershipId,
          email: users.email,
          name: users.name,
          role: users.role,
          isActive: users.isActive,
          updatedAt: users.updatedAt,
        });

      await logAction(app.db, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: AuditAction.UPDATE,
        entityType: 'user',
        entityId: id,
        changes: body as Record<string, unknown>,
        ipAddress: request.ip,
      });

      return reply.status(200).send({ data: updated });
    },
  );

  // ── DELETE /users/:id — remove user ─────────────────────────────────────

  app.delete(
    '/users/:id',
    { preHandler: [app.requireRole(UserRole.OWNER)] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      if (id === request.user.sub) {
        throw badRequest('Cannot delete your own account');
      }

      const [existing] = await app.db
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            eq(users.id, id),
            eq(users.dealershipId, request.dealershipId),
          ),
        )
        .limit(1);

      if (!existing) {
        throw notFound('User not found');
      }

      await app.db.delete(users).where(eq(users.id, id));

      await logAction(app.db, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: AuditAction.DELETE,
        entityType: 'user',
        entityId: id,
        ipAddress: request.ip,
      });

      return reply.status(200).send({ message: 'User deleted successfully' });
    },
  );
}
