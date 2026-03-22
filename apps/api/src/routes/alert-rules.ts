// ---------------------------------------------------------------------------
// RV Trax API — Alert rule routes (CRUD /api/v1/alert-rules)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { alertRules } from '@rv-trax/db';
import {
  UserRole,
  createAlertRuleSchema,
  updateAlertRuleSchema,
  ALERT_RULE_TYPE_SCHEMAS,
  KNOWN_ALERT_RULE_TYPES,
} from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, validationError, badRequest } from '../utils/errors.js';

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
    if (!KNOWN_ALERT_RULE_TYPES.includes(body.rule_type)) {
      throw validationError(
        `Unknown rule_type "${body.rule_type}". Valid types: ${KNOWN_ALERT_RULE_TYPES.join(', ')}`,
      );
    }

    // Validate parameters match expected schema for the rule type
    const paramSchema = ALERT_RULE_TYPE_SCHEMAS[body.rule_type]!;
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
      const paramSchema = ALERT_RULE_TYPE_SCHEMAS[existing.ruleType];
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
