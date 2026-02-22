// ---------------------------------------------------------------------------
// RV Trax API — Billing routes (GET/POST /api/v1/billing)
// ---------------------------------------------------------------------------

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Readable } from 'node:stream';
import { eq, desc, gt, and, count } from 'drizzle-orm';
import { billingEvents, dealerships } from '@rv-trax/db';
import {
  updateSubscriptionSchema,
  AuditAction,
  UserRole,
  paginationSchema,
} from '@rv-trax/shared';
import { enforceTenant } from '../middleware/tenant.js';
import { notFound, badRequest } from '../utils/errors.js';
import { decodeCursor, buildPaginatedResponse } from '../utils/pagination.js';
import { logAction } from '../services/audit.js';
import {
  getBillingOverview,
  getStripe,
  updateTier,
  handleSubscriptionEvent,
  recordBillingEvent,
  createCheckoutSession,
  createSetupIntent,
  listPaymentMethods,
  detachPaymentMethod,
  setDefaultPaymentMethod,
} from '../services/billing.js';

export default async function billingRoutes(app: FastifyInstance): Promise<void> {
  // ── Authenticated routes (owner/manager) ──────────────────────────────────

  app.register(async (authedApp) => {
    authedApp.addHook('preHandler', app.authenticate);
    authedApp.addHook('preHandler', enforceTenant);

    // ── GET / — billing overview ───────────────────────────────────────────

    authedApp.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
      const overview = await getBillingOverview(app.db, request.dealershipId);

      if (!overview) {
        throw notFound('Dealership not found');
      }

      return reply.status(200).send({ data: overview });
    });

    // ── GET /invoices — list billing events/invoices ───────────────────────

    authedApp.get('/invoices', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, string | undefined>;
      const { limit, cursor } = paginationSchema.parse(query);

      const conditions = [
        eq(billingEvents.dealershipId, request.dealershipId),
      ];

      if (cursor) {
        const decodedId = decodeCursor(cursor);
        conditions.push(gt(billingEvents.id, decodedId));
      }

      const where = and(...conditions);

      const rows = await app.db
        .select()
        .from(billingEvents)
        .where(where)
        .orderBy(desc(billingEvents.processedAt))
        .limit(limit + 1);

      // For total count we skip the cursor filter
      const [countResult] = await app.db
        .select({ value: count() })
        .from(billingEvents)
        .where(eq(billingEvents.dealershipId, request.dealershipId));

      const totalCount = countResult?.value ?? 0;

      return reply.status(200).send(buildPaginatedResponse(rows, limit, totalCount));
    });

    // ── POST /update-tier — change subscription tier ──────────────────────

    authedApp.post(
      '/update-tier',
      { preHandler: [app.requireRole(UserRole.OWNER, UserRole.MANAGER)] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const body = updateSubscriptionSchema.parse(request.body);

        // Verify dealership exists
        const [dealership] = await app.db
          .select({ id: dealerships.id, subscriptionTier: dealerships.subscriptionTier })
          .from(dealerships)
          .where(eq(dealerships.id, request.dealershipId))
          .limit(1);

        if (!dealership) {
          throw notFound('Dealership not found');
        }

        if (dealership.subscriptionTier === body.tier) {
          throw badRequest('Already on this subscription tier');
        }

        await updateTier(app.db, request.dealershipId, body.tier);

        await logAction(app.db, {
          dealershipId: request.dealershipId,
          userId: request.user.sub,
          action: AuditAction.UPDATE,
          entityType: 'subscription',
          entityId: request.dealershipId,
          changes: {
            previous_tier: dealership.subscriptionTier,
            new_tier: body.tier,
          },
          ipAddress: request.ip,
        });

        app.log.info(
          { dealershipId: request.dealershipId, newTier: body.tier },
          'Subscription tier updated',
        );

        return reply.status(200).send({
          message: 'Subscription tier updated',
          data: { tier: body.tier },
        });
      },
    );

    // ── POST /checkout — create Stripe Checkout Session ───────────────────

    authedApp.post(
      '/checkout',
      { preHandler: [app.requireRole(UserRole.OWNER, UserRole.MANAGER)] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const body = (request.body as { tier?: string; success_url?: string; cancel_url?: string }) ?? {};
        const tier = body.tier;
        const baseUrl = process.env['WEB_APP_URL'] ?? 'http://localhost:3000';
        const successUrl = body.success_url ?? `${baseUrl}/settings/billing?success=true`;
        const cancelUrl = body.cancel_url ?? `${baseUrl}/settings/billing?cancelled=true`;

        if (!tier || !['starter', 'professional', 'enterprise'].includes(tier)) {
          throw badRequest('Invalid subscription tier');
        }

        const url = await createCheckoutSession(
          app.db,
          request.dealershipId,
          tier,
          successUrl,
          cancelUrl,
        );

        if (!url) {
          throw badRequest('Unable to create checkout session. Stripe may not be configured.');
        }

        return reply.status(200).send({ data: { url } });
      },
    );

    // ── GET /payment-methods — list saved payment methods ─────────────────

    authedApp.get('/payment-methods', async (request: FastifyRequest, reply: FastifyReply) => {
      const methods = await listPaymentMethods(app.db, request.dealershipId);
      return reply.status(200).send({ data: methods });
    });

    // ── POST /payment-methods/setup — create SetupIntent for adding card ──

    authedApp.post(
      '/payment-methods/setup',
      { preHandler: [app.requireRole(UserRole.OWNER, UserRole.MANAGER)] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const clientSecret = await createSetupIntent(app.db, request.dealershipId);

        if (!clientSecret) {
          throw badRequest('Unable to create setup intent. Stripe may not be configured.');
        }

        return reply.status(200).send({ data: { clientSecret } });
      },
    );

    // ── POST /payment-methods/:id/default — set default payment method ────

    authedApp.post(
      '/payment-methods/:id/default',
      { preHandler: [app.requireRole(UserRole.OWNER, UserRole.MANAGER)] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };

        const success = await setDefaultPaymentMethod(app.db, request.dealershipId, id);
        if (!success) {
          throw badRequest('Failed to set default payment method');
        }

        return reply.status(200).send({ message: 'Default payment method updated' });
      },
    );

    // ── DELETE /payment-methods/:id — remove a payment method ─────────────

    authedApp.delete(
      '/payment-methods/:id',
      { preHandler: [app.requireRole(UserRole.OWNER, UserRole.MANAGER)] },
      async (request: FastifyRequest, reply: FastifyReply) => {
        const { id } = request.params as { id: string };

        const success = await detachPaymentMethod(id);
        if (!success) {
          throw badRequest('Failed to remove payment method');
        }

        return reply.status(200).send({ message: 'Payment method removed' });
      },
    );
  });

  // ── Stripe webhook (NO auth) ──────────────────────────────────────────────

  app.post(
    '/webhooks/stripe',
    {
      preParsing: async (request: FastifyRequest, _reply: FastifyReply, payload: any) => {
        const chunks: Buffer[] = [];
        for await (const chunk of payload) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        (request as any).rawBody = Buffer.concat(chunks);
        return Readable.from((request as any).rawBody);
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Verify Stripe webhook signature when configured
      const stripe = getStripe();
      const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];

      if (stripe && webhookSecret) {
        const sig = request.headers['stripe-signature'];
        const rawBody = (request as any).rawBody as Buffer;

        if (!sig || !rawBody) {
          app.log.warn('Stripe webhook: missing signature or raw body');
          return reply.status(400).send({ error: 'Missing signature' });
        }

        try {
          stripe.webhooks.constructEvent(rawBody, sig as string, webhookSecret);
        } catch (err: any) {
          app.log.warn(`Stripe webhook signature verification failed: ${err.message}`);
          return reply.status(400).send({ error: 'Invalid signature' });
        }
      }

      const body = request.body as {
        id?: string;
        type?: string;
        data?: {
          object?: {
            customer?: string;
            amount_paid?: number;
            amount_due?: number;
            [key: string]: unknown;
          };
        };
      } | null;

      if (!body || !body.type) {
        app.log.warn('Stripe webhook received with no type');
        return reply.status(200).send({ received: true });
      }

      const eventType = body.type;
      const stripeEventId = body.id ?? 'unknown';
      const customerObject = body.data?.object;
      const stripeCustomerId = customerObject?.customer;

      if (!stripeCustomerId) {
        app.log.warn({ eventType }, 'Stripe webhook missing customer ID');
        return reply.status(200).send({ received: true });
      }

      // Look up dealership by stripeCustomerId
      const [dealership] = await app.db
        .select({ id: dealerships.id })
        .from(dealerships)
        .where(eq(dealerships.stripeCustomerId, stripeCustomerId))
        .limit(1);

      if (!dealership) {
        app.log.warn(
          { stripeCustomerId, eventType },
          'Stripe webhook: no dealership found for customer',
        );
        return reply.status(200).send({ received: true });
      }

      // Determine amount from the event data
      const amountCents =
        typeof customerObject?.amount_paid === 'number'
          ? customerObject.amount_paid
          : typeof customerObject?.amount_due === 'number'
            ? customerObject.amount_due
            : undefined;

      // Handle the subscription event
      await handleSubscriptionEvent(app.db, app.redis, dealership.id, eventType);

      // Record the billing event
      await recordBillingEvent(
        app.db,
        dealership.id,
        eventType,
        stripeEventId,
        amountCents,
        JSON.stringify(customerObject ?? {}),
      );

      app.log.info(
        { dealershipId: dealership.id, eventType, stripeEventId },
        'Stripe webhook processed',
      );

      return reply.status(200).send({ received: true });
    },
  );
}
