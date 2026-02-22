// ---------------------------------------------------------------------------
// RV Trax API — API Key management routes (JWT auth, owner/manager only)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { apiKeys, dealerships } from '@rv-trax/db';
import { createApiKeySchema, AuditAction, UserRole } from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound } from '../utils/errors.js';
import { logAction } from '../services/audit.js';
import crypto from 'node:crypto';
import { z } from 'zod';

// ── Local schemas -----------------------------------------------------------

const updateApiKeySchema = z.object({
  name: z.string().min(1).optional(),
  scopes: z.array(z.string().min(1)).optional(),
  is_active: z.boolean().optional(),
});

// ── Rate limit tiers --------------------------------------------------------

const RATE_LIMITS: Record<string, number> = {
  starter: 100,
  professional: 500,
  enterprise: 2000,
};

// ── Route registration -------------------------------------------------------

export default async function apiKeyRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth + tenant + owner/manager role
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);
  app.addHook('preHandler', app.requireRole(UserRole.OWNER, UserRole.MANAGER));

  // ── POST / — generate new API key -----------------------------------------

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createApiKeySchema.parse(request.body);

    // Generate random key
    const rawKey = `rvtrax_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 12);

    // Determine rate limit based on dealership tier
    const [dealership] = await app.db
      .select({ subscriptionTier: dealerships.subscriptionTier })
      .from(dealerships)
      .where(eq(dealerships.id, request.dealershipId))
      .limit(1);

    const tier = dealership?.subscriptionTier ?? 'starter';
    const rateLimitPerMin = RATE_LIMITS[tier] ?? 100;

    // Calculate expiration
    let expiresAt: Date | null = null;
    if (body.expires_in_days) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + body.expires_in_days);
    }

    const [apiKey] = await app.db
      .insert(apiKeys)
      .values({
        dealershipId: request.dealershipId,
        name: body.name,
        keyHash,
        keyPrefix,
        scopes: body.scopes.join(','),
        rateLimitPerMin,
        expiresAt,
      })
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.CREATE,
      entityType: 'api_key',
      entityId: apiKey!.id,
      changes: { name: body.name, scopes: body.scopes },
      ipAddress: request.ip,
    });

    return reply.status(201).send({
      data: {
        id: apiKey!.id,
        name: apiKey!.name,
        key: rawKey, // Only time the raw key is visible
        key_prefix: keyPrefix,
        scopes: body.scopes,
        rate_limit_per_min: rateLimitPerMin,
        expires_at: expiresAt?.toISOString() ?? null,
        created_at: apiKey!.createdAt.toISOString(),
      },
    });
  });

  // ── GET / — list API keys (prefix only, never full key) -------------------

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const rows = await app.db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        rateLimitPerMin: apiKeys.rateLimitPerMin,
        isActive: apiKeys.isActive,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.dealershipId, request.dealershipId))
      .orderBy(desc(apiKeys.createdAt));

    const data = rows.map((row) => ({
      id: row.id,
      name: row.name,
      key_prefix: row.keyPrefix,
      scopes: row.scopes.split(','),
      rate_limit_per_min: row.rateLimitPerMin,
      is_active: row.isActive,
      last_used_at: row.lastUsedAt?.toISOString() ?? null,
      expires_at: row.expiresAt?.toISOString() ?? null,
      created_at: row.createdAt.toISOString(),
    }));

    return reply.status(200).send({ data });
  });

  // ── DELETE /:id — revoke API key -------------------------------------------

  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [existing] = await app.db
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.id, id),
          eq(apiKeys.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('API key not found');
    }

    await app.db.delete(apiKeys).where(eq(apiKeys.id, id));

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.DELETE,
      entityType: 'api_key',
      entityId: id,
      ipAddress: request.ip,
    });

    return reply.status(200).send({ message: 'API key revoked successfully' });
  });

  // ── PATCH /:id — update API key -------------------------------------------

  app.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateApiKeySchema.parse(request.body);

    const [existing] = await app.db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.id, id),
          eq(apiKeys.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('API key not found');
    }

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates['name'] = body.name;
    if (body.scopes !== undefined) updates['scopes'] = body.scopes.join(',');
    if (body.is_active !== undefined) updates['isActive'] = body.is_active;

    const [updated] = await app.db
      .update(apiKeys)
      .set(updates)
      .where(eq(apiKeys.id, id))
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.UPDATE,
      entityType: 'api_key',
      entityId: id,
      changes: body as Record<string, unknown>,
      ipAddress: request.ip,
    });

    return reply.status(200).send({
      data: {
        id: updated!.id,
        name: updated!.name,
        key_prefix: updated!.keyPrefix,
        scopes: updated!.scopes.split(','),
        rate_limit_per_min: updated!.rateLimitPerMin,
        is_active: updated!.isActive,
        last_used_at: updated!.lastUsedAt?.toISOString() ?? null,
        expires_at: updated!.expiresAt?.toISOString() ?? null,
        created_at: updated!.createdAt.toISOString(),
      },
    });
  });
}
