// ---------------------------------------------------------------------------
// RV Trax API — Dashboard configuration routes
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { dashboardConfigs } from '@rv-trax/db';
import { enforceTenant } from '../middleware/tenant.js';
import { z } from 'zod';

const widgetSchema = z.object({
  widget_id: z.string(),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1).max(4),
  h: z.number().int().min(1).max(4),
  config: z.record(z.unknown()).optional(),
});

const updateLayoutSchema = z.object({
  layout: z.array(widgetSchema),
});

// Default layout for new users
const DEFAULT_LAYOUT = [
  { widget_id: 'inventory_summary', x: 0, y: 0, w: 1, h: 1 },
  { widget_id: 'tracker_health', x: 1, y: 0, w: 1, h: 1 },
  { widget_id: 'alert_feed', x: 2, y: 0, w: 1, h: 1 },
  { widget_id: 'aging_chart', x: 0, y: 1, w: 2, h: 1 },
  { widget_id: 'recent_activity', x: 2, y: 1, w: 1, h: 1 },
  { widget_id: 'unit_status_breakdown', x: 0, y: 2, w: 1, h: 1 },
  { widget_id: 'quick_actions', x: 1, y: 2, w: 1, h: 1 },
];

export default async function dashboardConfigRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);

  // ── GET / — get user's dashboard layout ------------------------------------

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const [config] = await app.db
      .select()
      .from(dashboardConfigs)
      .where(
        and(
          eq(dashboardConfigs.userId, request.user.sub),
          eq(dashboardConfigs.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!config) {
      return reply.send({ data: { layout: DEFAULT_LAYOUT } });
    }

    return reply.send({ data: config });
  });

  // ── PUT / — save user's dashboard layout -----------------------------------

  app.put('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = updateLayoutSchema.parse(request.body);

    const [existing] = await app.db
      .select()
      .from(dashboardConfigs)
      .where(
        and(
          eq(dashboardConfigs.userId, request.user.sub),
          eq(dashboardConfigs.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (existing) {
      const [updated] = await app.db
        .update(dashboardConfigs)
        .set({ layout: body.layout, updatedAt: new Date() })
        .where(eq(dashboardConfigs.id, existing.id))
        .returning();
      return reply.send({ data: updated });
    }

    const [created] = await app.db
      .insert(dashboardConfigs)
      .values({
        userId: request.user.sub,
        dealershipId: request.dealershipId,
        layout: body.layout,
      })
      .returning();

    return reply.status(201).send({ data: created });
  });

  // ── POST /reset — reset to default layout ----------------------------------

  app.post('/reset', async (request: FastifyRequest, reply: FastifyReply) => {
    const [existing] = await app.db
      .select()
      .from(dashboardConfigs)
      .where(
        and(
          eq(dashboardConfigs.userId, request.user.sub),
          eq(dashboardConfigs.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (existing) {
      await app.db
        .update(dashboardConfigs)
        .set({ layout: DEFAULT_LAYOUT, updatedAt: new Date() })
        .where(eq(dashboardConfigs.id, existing.id));
    }

    return reply.send({ data: { layout: DEFAULT_LAYOUT } });
  });
}
