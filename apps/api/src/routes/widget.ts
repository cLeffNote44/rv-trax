// ---------------------------------------------------------------------------
// RV Trax API — Widget API routes
// Section A: Management routes (JWT auth, owner/manager)
// Section B: Public widget data endpoint (no auth)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, inArray } from 'drizzle-orm';
import { widgetConfigs, units, dealerships } from '@rv-trax/db';
import { updateWidgetConfigSchema, AuditAction, UserRole } from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound } from '../utils/errors.js';
import { logAction } from '../services/audit.js';

export default async function widgetRoutes(app: FastifyInstance): Promise<void> {
  // ── Section A: Management routes (JWT auth) --------------------------------

  app.register(async (authedApp) => {
    authedApp.addHook('preHandler', app.authenticate);
    authedApp.addHook('preHandler', enforceTenant);
    authedApp.addHook('preHandler', app.requireRole(UserRole.OWNER, UserRole.MANAGER));

    // ── GET /config — get widget config for dealership ----------------------

    authedApp.get('/config', async (request: FastifyRequest, reply: FastifyReply) => {
      const [config] = await app.db
        .select()
        .from(widgetConfigs)
        .where(eq(widgetConfigs.dealershipId, request.dealershipId))
        .limit(1);

      if (!config) {
        // Return default config if none exists
        return reply.status(200).send({
          data: {
            theme_color: '#3B82F6',
            show_statuses: ['available', 'lot_ready'],
            show_prices: true,
            link_template: null,
            is_active: false,
          },
        });
      }

      return reply.status(200).send({
        data: {
          id: config.id,
          theme_color: config.themeColor,
          show_statuses: config.showStatuses.split(',').map((s) => s.trim()),
          show_prices: config.showPrices,
          link_template: config.linkTemplate,
          is_active: config.isActive,
          created_at: config.createdAt.toISOString(),
          updated_at: config.updatedAt.toISOString(),
        },
      });
    });

    // ── PATCH /config — update widget config --------------------------------

    authedApp.patch('/config', async (request: FastifyRequest, reply: FastifyReply) => {
      const body = updateWidgetConfigSchema.parse(request.body);

      // Check if config exists
      const [existing] = await app.db
        .select({ id: widgetConfigs.id })
        .from(widgetConfigs)
        .where(eq(widgetConfigs.dealershipId, request.dealershipId))
        .limit(1);

      if (existing) {
        // Update existing config
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (body.theme_color !== undefined) updates['themeColor'] = body.theme_color;
        if (body.show_statuses !== undefined) updates['showStatuses'] = body.show_statuses.join(',');
        if (body.show_prices !== undefined) updates['showPrices'] = body.show_prices;
        if (body.link_template !== undefined) updates['linkTemplate'] = body.link_template;
        if (body.is_active !== undefined) updates['isActive'] = body.is_active;

        const [updated] = await app.db
          .update(widgetConfigs)
          .set(updates)
          .where(eq(widgetConfigs.id, existing.id))
          .returning();

        await logAction(app.db, {
          dealershipId: request.dealershipId,
          userId: request.user.sub,
          action: AuditAction.UPDATE,
          entityType: 'widget_config',
          entityId: updated!.id,
          changes: body as Record<string, unknown>,
          ipAddress: request.ip,
        });

        return reply.status(200).send({
          data: {
            id: updated!.id,
            theme_color: updated!.themeColor,
            show_statuses: updated!.showStatuses.split(',').map((s) => s.trim()),
            show_prices: updated!.showPrices,
            link_template: updated!.linkTemplate,
            is_active: updated!.isActive,
            updated_at: updated!.updatedAt.toISOString(),
          },
        });
      }

      // Create new config
      const [created] = await app.db
        .insert(widgetConfigs)
        .values({
          dealershipId: request.dealershipId,
          themeColor: body.theme_color ?? '#3B82F6',
          showStatuses: body.show_statuses?.join(',') ?? 'available,lot_ready',
          showPrices: body.show_prices ?? true,
          linkTemplate: body.link_template ?? null,
          isActive: body.is_active ?? false,
        })
        .returning();

      await logAction(app.db, {
        dealershipId: request.dealershipId,
        userId: request.user.sub,
        action: AuditAction.CREATE,
        entityType: 'widget_config',
        entityId: created!.id,
        changes: body as Record<string, unknown>,
        ipAddress: request.ip,
      });

      return reply.status(201).send({
        data: {
          id: created!.id,
          theme_color: created!.themeColor,
          show_statuses: created!.showStatuses.split(',').map((s) => s.trim()),
          show_prices: created!.showPrices,
          link_template: created!.linkTemplate,
          is_active: created!.isActive,
          created_at: created!.createdAt.toISOString(),
        },
      });
    });
  });

  // ── Section B: Public widget data endpoint (NO auth) -----------------------

  app.get('/data/:dealershipId', {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute',
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const { dealershipId } = request.params as { dealershipId: string };

    // Set CORS headers to allow any origin
    reply.header('Access-Control-Allow-Origin', '*');
    reply.header('Access-Control-Allow-Methods', 'GET');
    reply.header('Access-Control-Allow-Headers', 'Content-Type');

    // Verify widget is active for this dealership
    const [config] = await app.db
      .select()
      .from(widgetConfigs)
      .where(
        and(
          eq(widgetConfigs.dealershipId, dealershipId),
          eq(widgetConfigs.isActive, true),
        ),
      )
      .limit(1);

    if (!config) {
      throw notFound('Widget is not active for this dealership');
    }

    // Get dealership name
    const [dealership] = await app.db
      .select({ name: dealerships.name })
      .from(dealerships)
      .where(eq(dealerships.id, dealershipId))
      .limit(1);

    // Parse show statuses
    const showStatuses = config.showStatuses.split(',').map((s) => s.trim());

    // Query units where status is in showStatuses
    let unitRows: Array<{
      stock_number: string;
      year: number | null;
      make: string | null;
      model: string | null;
      unit_type: string | null;
      status: string;
      current_zone: string | null;
      msrp: string | null;
    }>;

    if (showStatuses.length > 0) {
      unitRows = await app.db
        .select({
          stock_number: units.stockNumber,
          year: units.year,
          make: units.make,
          model: units.model,
          unit_type: units.unitType,
          status: units.status,
          current_zone: units.currentZone,
          msrp: units.msrp,
        })
        .from(units)
        .where(
          and(
            eq(units.dealershipId, dealershipId),
            inArray(units.status, showStatuses),
          ),
        )
        .orderBy(units.stockNumber);
    } else {
      unitRows = [];
    }

    // Build response with optional price field
    const unitData = unitRows.map((row) => {
      const item: Record<string, unknown> = {
        stock_number: row.stock_number,
        year: row.year,
        make: row.make,
        model: row.model,
        unit_type: row.unit_type,
        status: row.status,
        current_zone: row.current_zone,
      };

      if (config.showPrices && row.msrp) {
        item['msrp'] = row.msrp;
      }

      return item;
    });

    return reply.status(200).send({
      dealership_name: dealership?.name ?? null,
      theme_color: config.themeColor,
      link_template: config.linkTemplate,
      units: unitData,
    });
  });
}
