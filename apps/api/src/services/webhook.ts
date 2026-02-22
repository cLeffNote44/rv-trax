// ---------------------------------------------------------------------------
// RV Trax API — Webhook dispatch service
// ---------------------------------------------------------------------------

import type { Database } from '@rv-trax/db';
import type Redis from 'ioredis';
import { webhookEndpoints, webhookDeliveries } from '@rv-trax/db';
import { eq, and } from 'drizzle-orm';
import crypto from 'node:crypto';

// ── Constants ---------------------------------------------------------------

const MAX_CONSECUTIVE_FAILURES = 10;
const DELIVERY_TIMEOUT_MS = 10_000;

// ── Public API --------------------------------------------------------------

/**
 * Dispatch a webhook event to all matching endpoints for a dealership.
 * For each endpoint that subscribes to this event:
 *   1. Build payload
 *   2. Sign with HMAC-SHA256 using the endpoint's secret
 *   3. POST to the URL
 *   4. Record delivery result
 *   5. If failed, increment failure count. After 10 consecutive failures, pause endpoint.
 */
export async function dispatchWebhook(
  db: Database,
  _redis: Redis,
  dealershipId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  // Fetch all active endpoints for this dealership
  const endpoints = await db
    .select()
    .from(webhookEndpoints)
    .where(
      and(
        eq(webhookEndpoints.dealershipId, dealershipId),
        eq(webhookEndpoints.status, 'active'),
      ),
    );

  for (const endpoint of endpoints) {
    // Check if this endpoint subscribes to the event
    const subscribedEvents = endpoint.events.split(',').map((e) => e.trim());
    if (!subscribedEvents.includes(eventType)) {
      continue;
    }

    const deliveryPayload = JSON.stringify({
      event: eventType,
      timestamp: new Date().toISOString(),
      dealership_id: dealershipId,
      data: payload,
    });

    const signature = signWebhookPayload(deliveryPayload, endpoint.secret);
    const result = await deliverWebhook(endpoint.url, deliveryPayload, signature);

    // Record delivery
    await db.insert(webhookDeliveries).values({
      webhookId: endpoint.id,
      eventType,
      payload: deliveryPayload,
      responseStatus: result.statusCode,
      responseBody: result.body,
      success: result.success,
    });

    // Update endpoint last triggered timestamp
    const updates: Record<string, unknown> = {
      lastTriggeredAt: new Date(),
    };

    if (result.success) {
      // Reset failure count on success
      updates['failureCount'] = 0;
    } else {
      // Increment failure count
      const newFailureCount = endpoint.failureCount + 1;
      updates['failureCount'] = newFailureCount;

      // Pause endpoint after too many consecutive failures
      if (newFailureCount >= MAX_CONSECUTIVE_FAILURES) {
        updates['status'] = 'paused';
      }
    }

    await db
      .update(webhookEndpoints)
      .set(updates)
      .where(eq(webhookEndpoints.id, endpoint.id));
  }
}

/**
 * Generate HMAC-SHA256 signature for webhook payload.
 */
export function signWebhookPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Deliver a single webhook — HTTP POST with signature header.
 * Returns { success, statusCode, body }
 */
async function deliverWebhook(
  url: string,
  payload: string,
  signature: string,
): Promise<{ success: boolean; statusCode: number | null; body: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RVTrax-Signature': `sha256=${signature}`,
      },
      body: payload,
      signal: controller.signal,
    });

    const body = await response.text();
    const success = response.status >= 200 && response.status < 300;

    return { success, statusCode: response.status, body };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown delivery error';
    return { success: false, statusCode: null, body: message };
  } finally {
    clearTimeout(timeout);
  }
}
