// ---------------------------------------------------------------------------
// RV Trax API — Dealership settings routes (GET/PATCH /api/v1/settings)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { dealerships, featureFlags } from '@rv-trax/db';
import {
  updateDealershipSettingsSchema,
  setFeatureFlagSchema,
  AuditAction,
  UserRole,
} from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound } from '../utils/errors.js';
import { logAction } from '../services/audit.js';

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

      if (existing) {
        // Update existing flag
        await app.db
          .update(featureFlags)
          .set({
            enabled: body.enabled,
            updatedAt: new Date(),
          })
          .where(eq(featureFlags.id, existing.id));
      } else {
        // Insert new flag
        await app.db.insert(featureFlags).values({
          dealershipId: request.dealershipId,
          feature: body.feature,
          enabled: body.enabled,
        });
      }

      await logAction(app.db, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: existing ? AuditAction.UPDATE : AuditAction.CREATE,
        entityType: 'feature_flag',
        entityId: body.feature,
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
}
