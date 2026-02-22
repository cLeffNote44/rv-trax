// ---------------------------------------------------------------------------
// RV Trax API — DMS integration routes (JWT auth, owner/manager only)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, desc, gt, count } from 'drizzle-orm';
import { dmsIntegrations, dmsSyncLogs, units } from '@rv-trax/db';
import {
  createDmsIntegrationSchema,
  AuditAction,
  UserRole,
  paginationSchema,
} from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, badRequest } from '../utils/errors.js';
import { decodeCursor, buildPaginatedResponse } from '../utils/pagination.js';
import { logAction } from '../services/audit.js';
import { getAdapter } from '../services/dms-adapter.js';
import { z } from 'zod';

// ── Local schemas -----------------------------------------------------------

const updateDmsIntegrationSchema = z.object({
  config: z.record(z.string(), z.unknown()).optional(),
  is_active: z.boolean().optional(),
});

// ── Route registration -------------------------------------------------------

export default async function dmsRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth + tenant + owner/manager role
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);
  app.addHook('preHandler', app.requireRole(UserRole.OWNER, UserRole.MANAGER));

  // ── POST / — create DMS integration --------------------------------------

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createDmsIntegrationSchema.parse(request.body);

    const [integration] = await app.db
      .insert(dmsIntegrations)
      .values({
        dealershipId: request.dealershipId,
        provider: body.provider,
        config: JSON.stringify(body.config),
      })
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.CREATE,
      entityType: 'dms_integration',
      entityId: integration!.id,
      changes: { provider: body.provider },
      ipAddress: request.ip,
    });

    return reply.status(201).send({
      data: {
        id: integration!.id,
        provider: integration!.provider,
        config: safeParseJson(integration!.config),
        sync_status: integration!.syncStatus,
        is_active: integration!.isActive,
        created_at: integration!.createdAt.toISOString(),
      },
    });
  });

  // ── GET / — list DMS integrations -----------------------------------------

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const rows = await app.db
      .select()
      .from(dmsIntegrations)
      .where(eq(dmsIntegrations.dealershipId, request.dealershipId))
      .orderBy(desc(dmsIntegrations.createdAt));

    const data = rows.map((row) => ({
      id: row.id,
      provider: row.provider,
      sync_status: row.syncStatus,
      last_sync_at: row.lastSyncAt?.toISOString() ?? null,
      last_error: row.lastError,
      is_active: row.isActive,
      created_at: row.createdAt.toISOString(),
    }));

    return reply.status(200).send({ data });
  });

  // ── GET /:id — integration detail with recent sync logs -------------------

  app.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [integration] = await app.db
      .select()
      .from(dmsIntegrations)
      .where(
        and(
          eq(dmsIntegrations.id, id),
          eq(dmsIntegrations.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!integration) {
      throw notFound('DMS integration not found');
    }

    // Fetch recent sync logs
    const recentLogs = await app.db
      .select()
      .from(dmsSyncLogs)
      .where(eq(dmsSyncLogs.integrationId, id))
      .orderBy(desc(dmsSyncLogs.startedAt))
      .limit(20);

    return reply.status(200).send({
      data: {
        id: integration.id,
        provider: integration.provider,
        config: safeParseJson(integration.config),
        sync_status: integration.syncStatus,
        last_sync_at: integration.lastSyncAt?.toISOString() ?? null,
        last_error: integration.lastError,
        is_active: integration.isActive,
        created_at: integration.createdAt.toISOString(),
        updated_at: integration.updatedAt.toISOString(),
        recent_sync_logs: recentLogs.map((log) => ({
          id: log.id,
          direction: log.direction,
          units_created: log.unitsCreated,
          units_updated: log.unitsUpdated,
          errors: log.errors,
          started_at: log.startedAt.toISOString(),
          completed_at: log.completedAt?.toISOString() ?? null,
        })),
      },
    });
  });

  // ── PATCH /:id — update integration config --------------------------------

  app.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateDmsIntegrationSchema.parse(request.body);

    const [existing] = await app.db
      .select()
      .from(dmsIntegrations)
      .where(
        and(
          eq(dmsIntegrations.id, id),
          eq(dmsIntegrations.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('DMS integration not found');
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.config !== undefined) updates['config'] = JSON.stringify(body.config);
    if (body.is_active !== undefined) updates['isActive'] = body.is_active;

    const [updated] = await app.db
      .update(dmsIntegrations)
      .set(updates)
      .where(eq(dmsIntegrations.id, id))
      .returning();

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.UPDATE,
      entityType: 'dms_integration',
      entityId: id,
      changes: { is_active: body.is_active },
      ipAddress: request.ip,
    });

    return reply.status(200).send({
      data: {
        id: updated!.id,
        provider: updated!.provider,
        config: safeParseJson(updated!.config),
        sync_status: updated!.syncStatus,
        is_active: updated!.isActive,
        updated_at: updated!.updatedAt.toISOString(),
      },
    });
  });

  // ── DELETE /:id — delete integration --------------------------------------

  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [existing] = await app.db
      .select({ id: dmsIntegrations.id })
      .from(dmsIntegrations)
      .where(
        and(
          eq(dmsIntegrations.id, id),
          eq(dmsIntegrations.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('DMS integration not found');
    }

    // Delete sync logs first, then integration
    await app.db
      .delete(dmsSyncLogs)
      .where(eq(dmsSyncLogs.integrationId, id));

    await app.db
      .delete(dmsIntegrations)
      .where(eq(dmsIntegrations.id, id));

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.DELETE,
      entityType: 'dms_integration',
      entityId: id,
      ipAddress: request.ip,
    });

    return reply.status(200).send({ message: 'DMS integration deleted successfully' });
  });

  // ── POST /:id/test — test DMS connection ----------------------------------

  app.post('/:id/test', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [integration] = await app.db
      .select()
      .from(dmsIntegrations)
      .where(
        and(
          eq(dmsIntegrations.id, id),
          eq(dmsIntegrations.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!integration) {
      throw notFound('DMS integration not found');
    }

    const config = safeParseJson(integration.config);

    try {
      const adapter = getAdapter(integration.provider);
      const success = await adapter.testConnection(config);

      return reply.status(200).send({
        data: {
          success,
          message: success
            ? 'Connection successful'
            : 'Connection failed — check your configuration',
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return reply.status(200).send({
        data: {
          success: false,
          message: `Connection test failed: ${message}`,
        },
      });
    }
  });

  // ── POST /:id/sync — trigger manual sync ----------------------------------

  app.post('/:id/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [integration] = await app.db
      .select()
      .from(dmsIntegrations)
      .where(
        and(
          eq(dmsIntegrations.id, id),
          eq(dmsIntegrations.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!integration) {
      throw notFound('DMS integration not found');
    }

    if (!integration.isActive) {
      throw badRequest('Integration is disabled');
    }

    if (integration.syncStatus === 'syncing') {
      throw badRequest('A sync is already in progress');
    }

    // Mark as syncing
    await app.db
      .update(dmsIntegrations)
      .set({ syncStatus: 'syncing', updatedAt: new Date() })
      .where(eq(dmsIntegrations.id, id));

    // Create sync log entry
    const [syncLog] = await app.db
      .insert(dmsSyncLogs)
      .values({
        integrationId: id,
        direction: 'pull',
      })
      .returning();

    let unitsCreated = 0;
    let unitsUpdated = 0;
    let errorCount = 0;
    let syncError: string | null = null;

    try {
      const config = safeParseJson(integration.config);
      const adapter = getAdapter(integration.provider);
      const pulledUnits = await adapter.pullUnits(config);

      // Upsert each pulled unit
      for (const dmsUnit of pulledUnits) {
        try {
          // Check if unit already exists by VIN + dealershipId
          const [existingUnit] = await app.db
            .select({ id: units.id })
            .from(units)
            .where(
              and(
                eq(units.vin, dmsUnit.vin),
                eq(units.dealershipId, request.dealershipId),
              ),
            )
            .limit(1);

          if (existingUnit) {
            // Update existing unit
            await app.db
              .update(units)
              .set({
                stockNumber: dmsUnit.stock_number,
                year: dmsUnit.year,
                make: dmsUnit.make,
                model: dmsUnit.model,
                msrp: dmsUnit.msrp?.toString() ?? null,
                status: dmsUnit.status,
                updatedAt: new Date(),
              })
              .where(eq(units.id, existingUnit.id));
            unitsUpdated++;
          } else {
            // Insert new unit
            await app.db.insert(units).values({
              dealershipId: request.dealershipId,
              stockNumber: dmsUnit.stock_number,
              vin: dmsUnit.vin,
              year: dmsUnit.year,
              make: dmsUnit.make,
              model: dmsUnit.model,
              msrp: dmsUnit.msrp?.toString() ?? null,
              status: dmsUnit.status || 'new_arrival',
            });
            unitsCreated++;
          }
        } catch {
          errorCount++;
        }
      }

      // Update integration status
      await app.db
        .update(dmsIntegrations)
        .set({
          syncStatus: 'success',
          lastSyncAt: new Date(),
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(dmsIntegrations.id, id));
    } catch (err: unknown) {
      syncError = err instanceof Error ? err.message : 'Unknown sync error';

      await app.db
        .update(dmsIntegrations)
        .set({
          syncStatus: 'error',
          lastError: syncError,
          updatedAt: new Date(),
        })
        .where(eq(dmsIntegrations.id, id));
    }

    // Complete sync log
    await app.db
      .update(dmsSyncLogs)
      .set({
        unitsCreated,
        unitsUpdated,
        errors: errorCount,
        completedAt: new Date(),
      })
      .where(eq(dmsSyncLogs.id, syncLog!.id));

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.UPDATE,
      entityType: 'dms_integration',
      entityId: id,
      changes: {
        action: 'sync',
        units_created: unitsCreated,
        units_updated: unitsUpdated,
        errors: errorCount,
      },
      ipAddress: request.ip,
    });

    return reply.status(200).send({
      data: {
        sync_log_id: syncLog!.id,
        units_created: unitsCreated,
        units_updated: unitsUpdated,
        errors: errorCount,
        error_message: syncError,
      },
    });
  });

  // ── POST /:id/upload — upload CSV file for csv_import integrations --------

  app.post('/:id/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [integration] = await app.db
      .select()
      .from(dmsIntegrations)
      .where(
        and(
          eq(dmsIntegrations.id, id),
          eq(dmsIntegrations.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!integration) {
      throw notFound('DMS integration not found');
    }

    if (integration.provider !== 'csv_import') {
      throw badRequest('CSV upload is only supported for csv_import integrations');
    }

    // Accept multipart or raw text body with CSV content
    const body = request.body as
      | { csv_data?: string; has_header?: boolean; column_mapping?: Record<string, string> }
      | null;

    if (!body || typeof body['csv_data'] !== 'string' || !body['csv_data'].trim()) {
      throw badRequest('Request body must include csv_data as a non-empty string');
    }

    // Merge CSV data into the existing config
    const existingConfig = safeParseJson(integration.config);
    const updatedConfig: Record<string, unknown> = {
      ...existingConfig,
      csv_data: body['csv_data'],
    };
    if (body.has_header !== undefined) updatedConfig['has_header'] = body.has_header;
    if (body.column_mapping !== undefined) updatedConfig['column_mapping'] = body.column_mapping;

    await app.db
      .update(dmsIntegrations)
      .set({
        config: JSON.stringify(updatedConfig),
        updatedAt: new Date(),
      })
      .where(eq(dmsIntegrations.id, id));

    await logAction(app.db, {
      dealershipId: request.dealershipId,
      userId: request.user.sub,
      action: AuditAction.UPDATE,
      entityType: 'dms_integration',
      entityId: id,
      changes: { action: 'csv_upload', csv_size: body['csv_data'].length },
      ipAddress: request.ip,
    });

    return reply.status(200).send({
      message: 'CSV data uploaded successfully. Trigger a sync to import units.',
      data: { csv_size: body['csv_data'].length },
    });
  });

  // ── GET /:id/logs — list sync logs (paginated) ----------------------------

  app.get('/:id/logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const query = request.query as Record<string, string | undefined>;
    const { limit, cursor } = paginationSchema.parse(query);

    // Verify integration exists and belongs to dealership
    const [integration] = await app.db
      .select({ id: dmsIntegrations.id })
      .from(dmsIntegrations)
      .where(
        and(
          eq(dmsIntegrations.id, id),
          eq(dmsIntegrations.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!integration) {
      throw notFound('DMS integration not found');
    }

    const conditions = [eq(dmsSyncLogs.integrationId, id)];

    if (cursor) {
      const decodedId = decodeCursor(cursor);
      conditions.push(gt(dmsSyncLogs.id, decodedId));
    }

    const where = and(...conditions);

    const [countResult] = await app.db
      .select({ value: count() })
      .from(dmsSyncLogs)
      .where(eq(dmsSyncLogs.integrationId, id));

    const totalCount = countResult?.value ?? 0;

    const rows = await app.db
      .select()
      .from(dmsSyncLogs)
      .where(where)
      .orderBy(desc(dmsSyncLogs.startedAt))
      .limit(limit + 1);

    return reply.status(200).send(buildPaginatedResponse(rows, limit, totalCount));
  });
}

// ── Helpers ------------------------------------------------------------------

function safeParseJson(value: string): Record<string, unknown> {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}
