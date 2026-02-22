// ---------------------------------------------------------------------------
// RV Trax API — Billing service (Stripe integration)
// ---------------------------------------------------------------------------

import Stripe from 'stripe';
import type { Database } from '@rv-trax/db';
import type Redis from 'ioredis';
import { dealerships, billingEvents, units, lots } from '@rv-trax/db';
import { eq, count } from 'drizzle-orm';

// ── Lazy Stripe client ──────────────────────────────────────────────────────

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (stripeClient) return stripeClient;
  const key = process.env['STRIPE_SECRET_KEY'];
  if (!key) return null;
  stripeClient = new Stripe(key, { apiVersion: '2024-12-18.acacia' as any });
  return stripeClient;
}

const TIER_PRICE_IDS: Record<string, string | undefined> = {
  starter: process.env['STRIPE_PRICE_STARTER'],
  professional: process.env['STRIPE_PRICE_PROFESSIONAL'],
  enterprise: process.env['STRIPE_PRICE_ENTERPRISE'],
};

function getPriceId(tier: string): string | undefined {
  return TIER_PRICE_IDS[tier];
}

// ── Tier limits ─────────────────────────────────────────────────────────────

const TIER_LIMITS: Record<string, { units: number; lots: number }> = {
  starter: { units: 100, lots: 1 },
  professional: { units: 300, lots: 3 },
  enterprise: { units: Infinity, lots: Infinity },
};

const GRACE_PERIOD_DAYS = 7;
const GRACE_PERIOD_SECONDS = GRACE_PERIOD_DAYS * 24 * 60 * 60;

function redisGraceKey(dealershipId: string): string {
  return `billing:grace:${dealershipId}`;
}

export interface BillingOverview {
  dealershipId: string;
  stripeCustomerId: string | null;
  subscriptionTier: string;
  subscriptionStatus: string;
  unitCount: number;
  unitLimit: number;
  lotCount: number;
  lotLimit: number;
  isOverLimit: boolean;
}

/**
 * Get billing overview for a dealership.
 * Queries dealership for tier info, counts units and lots, computes limits.
 */
export async function getBillingOverview(
  db: Database,
  dealershipId: string,
): Promise<BillingOverview | null> {
  const [dealership] = await db
    .select({
      id: dealerships.id,
      stripeCustomerId: dealerships.stripeCustomerId,
      subscriptionTier: dealerships.subscriptionTier,
      subscriptionStatus: dealerships.subscriptionStatus,
    })
    .from(dealerships)
    .where(eq(dealerships.id, dealershipId))
    .limit(1);

  if (!dealership) {
    return null;
  }

  const [unitCountResult] = await db
    .select({ value: count() })
    .from(units)
    .where(eq(units.dealershipId, dealershipId));

  const unitCount = unitCountResult?.value ?? 0;

  const [lotCountResult] = await db
    .select({ value: count() })
    .from(lots)
    .where(eq(lots.dealershipId, dealershipId));

  const lotCount = lotCountResult?.value ?? 0;

  const tierKey = dealership.subscriptionTier;
  const limits = TIER_LIMITS[tierKey] ?? TIER_LIMITS['starter']!;

  return {
    dealershipId: dealership.id,
    stripeCustomerId: dealership.stripeCustomerId,
    subscriptionTier: dealership.subscriptionTier,
    subscriptionStatus: dealership.subscriptionStatus,
    unitCount,
    unitLimit: limits.units,
    lotCount,
    lotLimit: limits.lots,
    isOverLimit: unitCount > limits.units || lotCount > limits.lots,
  };
}

/**
 * Check if a dealership can add more units (for enforcement).
 * Returns true if current unit count < tier limit.
 */
export async function canAddUnit(
  db: Database,
  dealershipId: string,
): Promise<boolean> {
  const [dealership] = await db
    .select({ subscriptionTier: dealerships.subscriptionTier })
    .from(dealerships)
    .where(eq(dealerships.id, dealershipId))
    .limit(1);

  if (!dealership) {
    return false;
  }

  const tierKey = dealership.subscriptionTier;
  const limits = TIER_LIMITS[tierKey] ?? TIER_LIMITS['starter']!;

  const [unitCountResult] = await db
    .select({ value: count() })
    .from(units)
    .where(eq(units.dealershipId, dealershipId));

  const unitCount = unitCountResult?.value ?? 0;

  return unitCount < limits.units;
}

/**
 * Check if dealership is in restricted mode.
 * (subscription lapsed beyond grace period)
 *
 * If subscriptionStatus is 'past_due', checks the Redis grace-period key.
 * If 'cancelled' or 'restricted', returns true immediately.
 */
export async function isRestricted(
  db: Database,
  redis: Redis,
  dealershipId: string,
): Promise<boolean> {
  const [dealership] = await db
    .select({ subscriptionStatus: dealerships.subscriptionStatus })
    .from(dealerships)
    .where(eq(dealerships.id, dealershipId))
    .limit(1);

  if (!dealership) {
    return true;
  }

  const status = dealership.subscriptionStatus;

  if (status === 'cancelled' || status === 'restricted') {
    return true;
  }

  if (status === 'past_due') {
    // Check if grace period has expired (key no longer exists)
    const graceExists = await redis.exists(redisGraceKey(dealershipId));
    return graceExists === 0;
  }

  return false;
}

/**
 * Update subscription tier. If Stripe is configured, updates the subscription
 * price via the Stripe API. Falls back to DB-only update in dev mode.
 */
export async function updateTier(
  db: Database,
  dealershipId: string,
  newTier: string,
): Promise<void> {
  const stripe = getStripe();
  const priceId = getPriceId(newTier);

  if (stripe && priceId) {
    // Look up the dealership's Stripe customer
    const [dealership] = await db
      .select({
        stripeCustomerId: dealerships.stripeCustomerId,
      })
      .from(dealerships)
      .where(eq(dealerships.id, dealershipId))
      .limit(1);

    if (dealership?.stripeCustomerId) {
      // Find active subscription
      const subscriptions = await stripe.subscriptions.list({
        customer: dealership.stripeCustomerId,
        status: 'active',
        limit: 1,
      });

      const sub = subscriptions.data[0];
      if (sub && sub.items.data[0]) {
        await stripe.subscriptions.update(sub.id, {
          items: [{ id: sub.items.data[0].id, price: priceId }],
          proration_behavior: 'create_prorations',
        });
      }
    }
  } else if (process.env['NODE_ENV'] !== 'production') {
    console.info(
      `[billing] DEV SKIP — would update Stripe subscription for dealership=${dealershipId} to tier=${newTier}`,
    );
  }

  // Always update the local DB
  await db
    .update(dealerships)
    .set({
      subscriptionTier: newTier,
      updatedAt: new Date(),
    })
    .where(eq(dealerships.id, dealershipId));
}

/**
 * Record a billing event from Stripe webhook.
 */
export async function recordBillingEvent(
  db: Database,
  dealershipId: string,
  eventType: string,
  stripeEventId: string,
  amountCents?: number,
  details?: string,
): Promise<void> {
  await db.insert(billingEvents).values({
    dealershipId,
    eventType,
    stripeEventId,
    amountCents: amountCents ?? null,
    details: details ?? null,
  });
}

/**
 * Handle subscription status change based on Stripe event type.
 *
 * - invoice.paid -> set subscriptionStatus = 'active', clear grace period key
 * - invoice.payment_failed -> set subscriptionStatus = 'past_due', set Redis key with grace period TTL
 * - customer.subscription.deleted -> set subscriptionStatus = 'cancelled'
 */
export async function handleSubscriptionEvent(
  db: Database,
  redis: Redis,
  dealershipId: string,
  eventType: string,
): Promise<void> {
  if (eventType === 'invoice.paid') {
    await db
      .update(dealerships)
      .set({ subscriptionStatus: 'active', updatedAt: new Date() })
      .where(eq(dealerships.id, dealershipId));

    await redis.del(redisGraceKey(dealershipId));
  } else if (eventType === 'invoice.payment_failed') {
    await db
      .update(dealerships)
      .set({ subscriptionStatus: 'past_due', updatedAt: new Date() })
      .where(eq(dealerships.id, dealershipId));

    // Set grace period key with TTL
    await redis.set(
      redisGraceKey(dealershipId),
      new Date().toISOString(),
      'EX',
      GRACE_PERIOD_SECONDS,
    );
  } else if (
    eventType === 'customer.subscription.updated'
  ) {
    // Subscription updated — could be plan change, quantity change, etc.
    // Re-sync the tier from the Stripe subscription's price
    const stripe = getStripe();
    if (stripe) {
      const [dealership] = await db
        .select({ stripeCustomerId: dealerships.stripeCustomerId })
        .from(dealerships)
        .where(eq(dealerships.id, dealershipId))
        .limit(1);

      if (dealership?.stripeCustomerId) {
        const subs = await stripe.subscriptions.list({
          customer: dealership.stripeCustomerId,
          limit: 1,
        });

        const sub = subs.data[0];
        const priceId = sub?.items.data[0]?.price.id;

        if (priceId) {
          // Reverse-lookup tier from price ID
          const matchedTier = Object.entries(TIER_PRICE_IDS).find(
            ([, id]) => id === priceId,
          );
          if (matchedTier) {
            await db
              .update(dealerships)
              .set({
                subscriptionTier: matchedTier[0],
                subscriptionStatus: sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : 'active',
                updatedAt: new Date(),
              })
              .where(eq(dealerships.id, dealershipId));
          }
        }
      }
    }
  } else if (
    eventType === 'customer.subscription.deleted' ||
    eventType === 'subscription.deleted'
  ) {
    await db
      .update(dealerships)
      .set({ subscriptionStatus: 'cancelled', updatedAt: new Date() })
      .where(eq(dealerships.id, dealershipId));

    await redis.del(redisGraceKey(dealershipId));
  }
}

// ── Stripe Customer Management ──────────────────────────────────────────────

/**
 * Create a Stripe customer for a dealership and store the customer ID.
 * Returns the Stripe customer ID.
 */
export async function createStripeCustomer(
  db: Database,
  dealershipId: string,
  email: string,
  name: string,
): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) {
    if (process.env['NODE_ENV'] !== 'production') {
      console.info(`[billing] DEV SKIP — would create Stripe customer for dealership=${dealershipId}`);
      return null;
    }
    return null;
  }

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { dealership_id: dealershipId },
  });

  await db
    .update(dealerships)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(dealerships.id, dealershipId));

  return customer.id;
}

/**
 * Create a Stripe Checkout Session for subscribing to a tier.
 * Returns the checkout session URL.
 */
export async function createCheckoutSession(
  db: Database,
  dealershipId: string,
  tier: string,
  successUrl: string,
  cancelUrl: string,
): Promise<string | null> {
  const stripe = getStripe();
  const priceId = getPriceId(tier);
  if (!stripe || !priceId) return null;

  // Ensure dealership has a Stripe customer
  const [dealership] = await db
    .select({
      stripeCustomerId: dealerships.stripeCustomerId,
      name: dealerships.name,
    })
    .from(dealerships)
    .where(eq(dealerships.id, dealershipId))
    .limit(1);

  if (!dealership) return null;

  let customerId = dealership.stripeCustomerId;
  if (!customerId) {
    customerId = await createStripeCustomer(db, dealershipId, '', dealership.name);
    if (!customerId) return null;
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: { dealership_id: dealershipId },
  });

  return session.url;
}

/**
 * Create a SetupIntent for adding a payment method.
 * Returns the client secret for the frontend to complete the flow.
 */
export async function createSetupIntent(
  db: Database,
  dealershipId: string,
): Promise<string | null> {
  const stripe = getStripe();
  if (!stripe) return null;

  const [dealership] = await db
    .select({ stripeCustomerId: dealerships.stripeCustomerId })
    .from(dealerships)
    .where(eq(dealerships.id, dealershipId))
    .limit(1);

  if (!dealership?.stripeCustomerId) return null;

  const intent = await stripe.setupIntents.create({
    customer: dealership.stripeCustomerId,
    payment_method_types: ['card'],
  });

  return intent.client_secret;
}

/**
 * List payment methods for a dealership's Stripe customer.
 */
export async function listPaymentMethods(
  db: Database,
  dealershipId: string,
): Promise<Array<{ id: string; brand: string; last4: string; expMonth: number; expYear: number; isDefault: boolean }>> {
  const stripe = getStripe();
  if (!stripe) return [];

  const [dealership] = await db
    .select({ stripeCustomerId: dealerships.stripeCustomerId })
    .from(dealerships)
    .where(eq(dealerships.id, dealershipId))
    .limit(1);

  if (!dealership?.stripeCustomerId) return [];

  const methods = await stripe.paymentMethods.list({
    customer: dealership.stripeCustomerId,
    type: 'card',
  });

  // Get default payment method
  const customer = await stripe.customers.retrieve(dealership.stripeCustomerId);
  const defaultPm = (customer as Stripe.Customer).invoice_settings?.default_payment_method;

  return methods.data.map((pm) => ({
    id: pm.id,
    brand: pm.card?.brand ?? 'unknown',
    last4: pm.card?.last4 ?? '****',
    expMonth: pm.card?.exp_month ?? 0,
    expYear: pm.card?.exp_year ?? 0,
    isDefault: pm.id === defaultPm,
  }));
}

/**
 * Remove a payment method from a Stripe customer.
 */
export async function detachPaymentMethod(
  paymentMethodId: string,
): Promise<boolean> {
  const stripe = getStripe();
  if (!stripe) return false;

  try {
    await stripe.paymentMethods.detach(paymentMethodId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Set a payment method as the default for a customer.
 */
export async function setDefaultPaymentMethod(
  db: Database,
  dealershipId: string,
  paymentMethodId: string,
): Promise<boolean> {
  const stripe = getStripe();
  if (!stripe) return false;

  const [dealership] = await db
    .select({ stripeCustomerId: dealerships.stripeCustomerId })
    .from(dealerships)
    .where(eq(dealerships.id, dealershipId))
    .limit(1);

  if (!dealership?.stripeCustomerId) return false;

  try {
    await stripe.customers.update(dealership.stripeCustomerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    return true;
  } catch {
    return false;
  }
}
