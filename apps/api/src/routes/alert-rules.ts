// ---------------------------------------------------------------------------
// RV Trax API — Alert rule routes (CRUD /api/v1/alert-rules)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { alertRules } from '@rv-trax/db';
import { UserRole, AlertSeverity } from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, validationError, badRequest } from '../utils/errors.js';
import { z } from 'zod';

// ── Known rule types and their parameter schemas ----------------------------

const RULE_TYPE_SCHEMAS: Record<string, z.ZodType> = {
  geofence_exit: z.object({
    geo_fence_id: z.string().uuid().optional(),
  }),
  geofence_enter: z.object({
    geo_fence_id: z.string().uuid().optional(),
  }),
  after_hours_movement: z.object({
    start_hour: z.number().int().min(0).max(23),
    end_hour: z.number().int().min(0).max(23),
    timezone: z.string().min(1),
  }),
  aged_inventory: z.object({
    days_threshold: z.number().int().positive().default(90),
  }),
  tracker_battery_low: z.object({
    threshold_pct: z.number().int().min(1).max(100).default(20),
  }),
  tracker_offline: z.object({
    hours_threshold: z.number().positive().default(4),
  }),
  gateway_offline: z.object({
    minutes_threshold: z.number().positive().default(5),
  }),
};

const KNOWN_RULE_TYPES = Object.keys(RULE_TYPE_SCHEMAS);

const severityValues = Object.values(AlertSeverity) as [string, ...string[]];
const channelValues = ['in_app', 'push', 'email', 'sms'] as const;
const roleValues = Object.values(UserRole) as [string, ...string[]];

// ── Schemas -----------------------------------------------------------------

const createAlertRuleSchema = z.object({
  rule_type: z.string().min(1),
  parameters: z.record(z.unknown()).default({}),
  severity: z.enum(severityValues).default('warning'),
  channels: z.array(z.enum(channelValues)).default(['in_app']),
  recipient_roles: z.array(z.enum(roleValues)).optional(),
  recipient_user_ids: z.array(z.string().uuid()).optional(),
});

const updateAlertRuleSchema = z.object({
  parameters: z.record(z.unknown()).optional(),
  severity: z.enum(severityValues).optional(),
  channels: z.array(z.enum(channelValues)).optional(),
  recipient_roles: z.array(z.enum(roleValues)).optional(),
  recipient_user_ids: z.array(z.string().uuid()).optional(),
  is_active: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export default async function alertRuleRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth + tenant + manager/owner role
  app.addHook('preHandler', app.authenticate);
  app.addHook('preHandler', enforceTenant);
  app.addHook('preHandler', app.requireRole(UserRole.OWNER, UserRole.MANAGER));

  // ── POST / — create alert rule -------------------------------------------

  app.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createAlertRuleSchema.parse(request.body);

    // Validate rule_type is known
    if (!KNOWN_RULE_TYPES.includes(body.rule_type)) {
      throw validationError(
        `Unknown rule_type "${body.rule_type}". Valid types: ${KNOWN_RULE_TYPES.join(', ')}`,
      );
    }

    // Validate parameters match expected schema for the rule type
    const paramSchema = RULE_TYPE_SCHEMAS[body.rule_type]!;
    const paramResult = paramSchema.safeParse(body.parameters);
    if (!paramResult.success) {
      throw validationError(
        `Invalid parameters for rule type "${body.rule_type}"`,
        { issues: paramResult.error.issues },
      );
    }

    const [rule] = await app.db
      .insert(alertRules)
      .values({
        dealershipId: request.dealershipId,
        ruleType: body.rule_type,
        parameters: paramResult.data as Record<string, unknown>,
        severity: body.severity,
        channels: JSON.stringify(body.channels),
        recipientRoles: body.recipient_roles
          ? JSON.stringify(body.recipient_roles)
          : null,
        recipientUserIds: body.recipient_user_ids
          ? JSON.stringify(body.recipient_user_ids)
          : null,
      })
      .returning();

    return reply.status(201).send({ data: rule });
  });

  // ── GET / — list alert rules for dealership ------------------------------

  app.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const rows = await app.db
      .select({
        id: alertRules.id,
        ruleType: alertRules.ruleType,
        parameters: alertRules.parameters,
        severity: alertRules.severity,
        channels: alertRules.channels,
        isActive: alertRules.isActive,
        createdAt: alertRules.createdAt,
      })
      .from(alertRules)
      .where(eq(alertRules.dealershipId, request.dealershipId))
      .orderBy(alertRules.createdAt);

    return reply.status(200).send({ data: rows });
  });

  // ── PATCH /:id — update alert rule ---------------------------------------

  app.patch('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateAlertRuleSchema.parse(request.body);

    const [existing] = await app.db
      .select()
      .from(alertRules)
      .where(
        and(
          eq(alertRules.id, id),
          eq(alertRules.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('Alert rule not found');
    }

    const updates: Record<string, unknown> = {};

    if (body.parameters !== undefined) {
      // Validate parameters against the existing rule type
      const paramSchema = RULE_TYPE_SCHEMAS[existing.ruleType];
      if (paramSchema) {
        const paramResult = paramSchema.safeParse(body.parameters);
        if (!paramResult.success) {
          throw validationError(
            `Invalid parameters for rule type "${existing.ruleType}"`,
            { issues: paramResult.error.issues },
          );
        }
        updates['parameters'] = paramResult.data;
      } else {
        updates['parameters'] = body.parameters;
      }
    }

    if (body.severity !== undefined) {
      updates['severity'] = body.severity;
    }

    if (body.channels !== undefined) {
      updates['channels'] = JSON.stringify(body.channels);
    }

    if (body.recipient_roles !== undefined) {
      updates['recipientRoles'] = JSON.stringify(body.recipient_roles);
    }

    if (body.recipient_user_ids !== undefined) {
      updates['recipientUserIds'] = JSON.stringify(body.recipient_user_ids);
    }

    if (body.is_active !== undefined) {
      updates['isActive'] = body.is_active;
    }

    if (Object.keys(updates).length === 0) {
      throw badRequest('No updatable fields provided');
    }

    const [updated] = await app.db
      .update(alertRules)
      .set(updates)
      .where(eq(alertRules.id, id))
      .returning();

    return reply.status(200).send({ data: updated });
  });

  // ── DELETE /:id — delete alert rule --------------------------------------

  app.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const [existing] = await app.db
      .select({ id: alertRules.id })
      .from(alertRules)
      .where(
        and(
          eq(alertRules.id, id),
          eq(alertRules.dealershipId, request.dealershipId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw notFound('Alert rule not found');
    }

    await app.db
      .delete(alertRules)
      .where(eq(alertRules.id, id));

    return reply.status(200).send({ message: 'Alert rule deleted successfully' });
  });
}
