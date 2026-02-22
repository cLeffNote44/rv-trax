// ---------------------------------------------------------------------------
// RV Trax API — Webhook management routes (JWT auth, owner/manager only)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { webhookEndpoints, webhookDeliveries } from '@rv-trax/db';
import { createWebhookSchema, AuditAction, UserRole } from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound } from '../utils/errors.js';
import { logAction } from '../services/audit.js';
import { signWebhookPayload } from '../services/webhook.js';
import crypto from 'node:crypto';
import { z } from 'zod';

// ── Local schemas -----------------------------------------------------------

const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string().min(1)).optional(),
  status: z.enum(['active', 'paused']).optional(),
});

// ── Route registration -------------------------------------------------------

export default async function webhookRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth + tenant + owner/manager role
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);
  app.addHook('preHandler', app.requireRole(UserRole.OWNER, UserRole.MANAGER));

  // ── POST / — create webhook endpoint --------------------------------------

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createWebhookSchema.parse(request.body);

    // Auto-generate secret
    const secret = `whsec_${crypto.randomBytes(32).toString('hex')}`;

    const [webhook] = await app.db
      .insert(webhookEndpoints)
      .values({
        dealershipId: request.dealershipId,
        url: body.url,
        secret,
        events: body.events.join(','),
        status: 'active',
      })
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.CREATE,
      entityType: 'webhook_endpoint',
      entityId: webhook!.id,
      changes: { url: body.url, events: body.events },
      ipAddress: request.ip,
    });

    return reply.status(201).send({
      data: {
        id: webhook!.id,
        url: webhook!.url,
        secret, // Only shown on creation
        events: body.events,
        status: webhook!.status,
        failure_count: webhook!.failureCount,
        created_at: webhook!.createdAt.toISOString(),
      },
    });
  });

  // ── GET / — list webhook endpoints ----------------------------------------

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const rows = await app.db
      .select({
        id: webhookEndpoints.id,
        url: webhookEndpoints.url,
        events: webhookEndpoints.events,
        status: webhookEndpoints.status,
        failureCount: webhookEndpoints.failureCount,
        lastTriggeredAt: webhookEndpoints.lastTriggeredAt,
        createdAt: webhookEndpoints.createdAt,
      })
      .from(webhookEndpoints)
      .where(eq(webhookEndpoints.dealershipId, request.dealershipId))
      .orderBy(desc(webhookEndpoints.createdAt));

    const data = rows.map((row) => ({
      id: row.id,
      url: row.url,
      events: row.events.split(','),
      status: row.status,
      failure_count: row.failureCount,
      last_triggered_at: row.lastTriggeredAt?.toISOString() ?? null,
      created_at: row.createdAt.toISOString(),
    }));

    return reply.status(200).send({ data });
  });

  // ── GET /:id — webhook detail with recent deliveries ----------------------

  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [webhook] = await app.db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, id),
          eq(webhookEndpoints.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!webhook) {
      throw notFound('Webhook endpoint not found');
    }

    // Fetch recent deliveries
    const recentDeliveries = await app.db
      .select({
        id: webhookDeliveries.id,
        eventType: webhookDeliveries.eventType,
        responseStatus: webhookDeliveries.responseStatus,
        success: webhookDeliveries.success,
        attemptedAt: webhookDeliveries.attemptedAt,
      })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, id))
      .orderBy(desc(webhookDeliveries.attemptedAt))
      .limit(20);

    return reply.status(200).send({
      data: {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events.split(','),
        status: webhook.status,
        failure_count: webhook.failureCount,
        last_triggered_at: webhook.lastTriggeredAt?.toISOString() ?? null,
        created_at: webhook.createdAt.toISOString(),
        recent_deliveries: recentDeliveries.map((d) => ({
          id: d.id,
          event_type: d.eventType,
          response_status: d.responseStatus,
          success: d.success,
          attempted_at: d.attemptedAt.toISOString(),
        })),
      },
    });
  });

  // ── PATCH /:id — update webhook endpoint ----------------------------------

  app.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateWebhookSchema.parse(request.body);

    const [existing] = await app.db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, id),
          eq(webhookEndpoints.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('Webhook endpoint not found');
    }

    const updates: Record<string, unknown> = {};
    if (body.url !== undefined) updates['url'] = body.url;
    if (body.events !== undefined) updates['events'] = body.events.join(',');
    if (body.status !== undefined) {
      updates['status'] = body.status;
      // Reset failure count when manually re-activating
      if (body.status === 'active') {
        updates['failureCount'] = 0;
      }
    }

    const [updated] = await app.db
      .update(webhookEndpoints)
      .set(updates)
      .where(eq(webhookEndpoints.id, id))
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.UPDATE,
      entityType: 'webhook_endpoint',
      entityId: id,
      changes: body as Record<string, unknown>,
      ipAddress: request.ip,
    });

    return reply.status(200).send({
      data: {
        id: updated!.id,
        url: updated!.url,
        events: updated!.events.split(','),
        status: updated!.status,
        failure_count: updated!.failureCount,
        last_triggered_at: updated!.lastTriggeredAt?.toISOString() ?? null,
        created_at: updated!.createdAt.toISOString(),
      },
    });
  });

  // ── DELETE /:id — delete webhook endpoint ---------------------------------

  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [existing] = await app.db
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, id),
          eq(webhookEndpoints.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('Webhook endpoint not found');
    }

    // Delete deliveries first, then the endpoint
    await app.db
      .delete(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, id));

    await app.db
      .delete(webhookEndpoints)
      .where(eq(webhookEndpoints.id, id));

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.DELETE,
      entityType: 'webhook_endpoint',
      entityId: id,
      ipAddress: request.ip,
    });

    return reply.status(200).send({ message: 'Webhook endpoint deleted successfully' });
  });

  // ── GET /:id/deliveries — list recent deliveries --------------------------

  app.get('/:id/deliveries', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    // Verify webhook exists and belongs to dealership
    const [webhook] = await app.db
      .select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, id),
          eq(webhookEndpoints.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!webhook) {
      throw notFound('Webhook endpoint not found');
    }

    const rows = await app.db
      .select({
        id: webhookDeliveries.id,
        eventType: webhookDeliveries.eventType,
        payload: webhookDeliveries.payload,
        responseStatus: webhookDeliveries.responseStatus,
        responseBody: webhookDeliveries.responseBody,
        success: webhookDeliveries.success,
        attemptedAt: webhookDeliveries.attemptedAt,
      })
      .from(webhookDeliveries)
      .where(eq(webhookDeliveries.webhookId, id))
      .orderBy(desc(webhookDeliveries.attemptedAt))
      .limit(100);

    const data = rows.map((row) => ({
      id: row.id,
      event_type: row.eventType,
      payload: row.payload,
      response_status: row.responseStatus,
      response_body: row.responseBody,
      success: row.success,
      attempted_at: row.attemptedAt.toISOString(),
    }));

    return reply.status(200).send({ data });
  });

  // ── POST /:id/test — send a test webhook event ----------------------------

  app.post('/:id/test', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [webhook] = await app.db
      .select()
      .from(webhookEndpoints)
      .where(
        and(
          eq(webhookEndpoints.id, id),
          eq(webhookEndpoints.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!webhook) {
      throw notFound('Webhook endpoint not found');
    }

    // Build test payload and deliver directly (bypasses event filter)
    const testPayload = JSON.stringify({
      event: 'test.ping',
      timestamp: new Date().toISOString(),
      dealership_id: request.dealershipId,
      data: {
        message: 'This is a test webhook event from RV Trax',
        webhook_id: id,
        triggered_by: request.user.sub,
      },
    });

    const signature = signWebhookPayload(testPayload, webhook.secret);

    let success = false;
    let statusCode: number | null = null;
    let responseBody: string | null = null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RVTrax-Signature': `sha256=${signature}`,
        },
        body: testPayload,
        signal: controller.signal,
      });

      responseBody = await response.text();
      statusCode = response.status;
      success = response.status >= 200 && response.status < 300;
    } catch (err: unknown) {
      responseBody = err instanceof Error ? err.message : 'Unknown error';
    } finally {
      clearTimeout(timeout);
    }

    // Record delivery
    await app.db.insert(webhookDeliveries).values({
      webhookId: id,
      eventType: 'test.ping',
      payload: testPayload,
      responseStatus: statusCode,
      responseBody: responseBody,
      success,
    });

    return reply.status(200).send({
      message: 'Test webhook dispatched',
      data: { success, status_code: statusCode },
    });
  });
}
