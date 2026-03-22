// ---------------------------------------------------------------------------
// RV Trax API — White-label / branding routes (GET/PATCH /api/v1/white-label)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import { dealerships } from '@rv-trax/db';
import {
  UserRole,
  AuditAction,
  updateBrandingSchema,
  setCustomDomainSchema,
} from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, forbidden } from '../utils/errors.js';
import { logAction } from '../services/audit.js';

// ── Redis key helper --------------------------------------------------------

function brandingKey(groupId: string): string {
  return `group:${groupId}:branding`;
}

// ── Default branding values -------------------------------------------------

const DEFAULT_BRANDING = {
  logo_url: null as string | null,
  primary_color: '#1e40af',
  app_name: 'RV Trax',
  custom_domain: null as string | null,
};

// ── Group membership middleware (local copy to avoid circular dep) -----------

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

export default async function whiteLabelRoutes(
  app: FastifyInstance,
): Promise<void> {
  // All routes require auth + tenant
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── GET /branding — get group branding config ------------------------------

  app.get(
    '/branding',
    { preHandler: [requireGroupMember] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const key = brandingKey(request.groupId);
      const stored = await app.redis.hgetall(key);

      const branding = {
        logo_url: stored['logo_url'] || DEFAULT_BRANDING.logo_url,
        primary_color:
          stored['primary_color'] || DEFAULT_BRANDING.primary_color,
        app_name: stored['app_name'] || DEFAULT_BRANDING.app_name,
        custom_domain:
          stored['custom_domain'] || DEFAULT_BRANDING.custom_domain,
      };

      return reply.status(200).send({ data: branding });
    },
  );

  // ── PATCH /branding — update group branding --------------------------------

  app.patch(
    '/branding',
    {
      preHandler: [
        requireGroupMember,
        app.requireRole(UserRole.OWNER, UserRole.MANAGER),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = updateBrandingSchema.parse(request.body);
      const key = brandingKey(request.groupId);

      // Build fields to set
      const fields: Record<string, string> = {};
      if (body.logo_url !== undefined) fields['logo_url'] = body.logo_url;
      if (body.primary_color !== undefined)
        fields['primary_color'] = body.primary_color;
      if (body.app_name !== undefined) fields['app_name'] = body.app_name;

      if (Object.keys(fields).length > 0) {
        await app.redis.hset(key, fields);
      }

      // Read back the full branding
      const stored = await app.redis.hgetall(key);

      const branding = {
        logo_url: stored['logo_url'] || DEFAULT_BRANDING.logo_url,
        primary_color:
          stored['primary_color'] || DEFAULT_BRANDING.primary_color,
        app_name: stored['app_name'] || DEFAULT_BRANDING.app_name,
        custom_domain:
          stored['custom_domain'] || DEFAULT_BRANDING.custom_domain,
      };

      await logAction(app.db, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: AuditAction.UPDATE,
        entityType: 'group_branding',
        entityId: request.groupId,
        changes: body as Record<string, unknown>,
        ipAddress: request.ip,
      });

      return reply.status(200).send({ data: branding });
    },
  );

  // ── GET /custom-domain — get custom domain config --------------------------

  app.get(
    '/custom-domain',
    { preHandler: [requireGroupMember] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const key = brandingKey(request.groupId);
      const domain = await app.redis.hget(key, 'custom_domain');

      return reply.status(200).send({
        data: {
          custom_domain: domain || null,
          is_configured: !!domain,
        },
      });
    },
  );

  // ── POST /custom-domain — set custom domain --------------------------------

  app.post(
    '/custom-domain',
    {
      preHandler: [
        requireGroupMember,
        app.requireRole(UserRole.OWNER),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = setCustomDomainSchema.parse(request.body);
      const key = brandingKey(request.groupId);

      await app.redis.hset(key, 'custom_domain', body.domain);

      await logAction(app.db, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: AuditAction.UPDATE,
        entityType: 'group_custom_domain',
        entityId: request.groupId,
        changes: { custom_domain: body.domain },
        ipAddress: request.ip,
      });

      return reply.status(200).send({
        data: {
          custom_domain: body.domain,
          is_configured: true,
          message:
            'Custom domain saved. DNS configuration required for activation.',
        },
      });
    },
  );

  // ── DELETE /custom-domain — remove custom domain ----------------------------

  app.delete(
    '/custom-domain',
    {
      preHandler: [
        requireGroupMember,
        app.requireRole(UserRole.OWNER),
      ],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const key = brandingKey(request.groupId);

      await app.redis.hdel(key, 'custom_domain');

      await logAction(app.db, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: AuditAction.DELETE,
        entityType: 'group_custom_domain',
        entityId: request.groupId,
        ipAddress: request.ip,
      });

      return reply.status(200).send({
        data: {
          custom_domain: null,
          is_configured: false,
        },
      });
    },
  );
}
