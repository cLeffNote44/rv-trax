// ---------------------------------------------------------------------------
// RV Trax API — In-app notification delivery
// ---------------------------------------------------------------------------
//
// In-app notifications leverage the fact that the alert already exists in
// the alerts table. This module:
//   1. Increments the user's unread alert counter in Redis
//   2. Publishes the alert to a user-specific Redis Pub/Sub channel
//   3. The WebSocket server (ws module) subscribes to these channels and
//      forwards notifications to connected clients in real time
// ---------------------------------------------------------------------------

import type Redis from 'ioredis';
import type { Alert } from '@rv-trax/shared';
import type { InAppPayload } from './types.js';

// ── Redis Key Helpers ────────────────────────────────────────────────────────

function unreadCountKey(userId: string): string {
  return `user:${userId}:unread_alerts`;
}

function notificationChannel(userId: string): string {
  return `user:${userId}:notifications`;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Sends an in-app notification for an alert to a specific user.
 *
 * This does NOT insert anything into the database — the alert row already
 * exists. Instead it:
 *   - Increments the user's unread alert count (Redis counter)
 *   - Publishes the alert data to the user's notification channel
 *
 * The WebSocket server subscribes to `user:{userId}:notifications` and
 * forwards the payload to all connected browser/mobile sessions for that user.
 */
export async function sendInAppNotification(
  alert: Alert,
  userId: string,
  redis: Redis,
): Promise<void> {
  // Build the payload that the WebSocket server will forward
  const payload: InAppPayload = {
    alertId: alert.id,
    title: alert.title,
    message: alert.message,
    severity: alert.severity,
    unitId: alert.unit_id,
    createdAt: alert.created_at,
  };

  // Atomic pipeline: increment counter + publish notification
  const pipeline = redis.pipeline();

  // Increment unread count (no expiry — cleared when user views alerts)
  pipeline.incr(unreadCountKey(userId));

  // Publish to the user-specific channel
  pipeline.publish(notificationChannel(userId), JSON.stringify(payload));

  await pipeline.exec();
}

/**
 * Returns the current unread alert count for a user.
 */
export async function getUnreadCount(
  userId: string,
  redis: Redis,
): Promise<number> {
  const count = await redis.get(unreadCountKey(userId));
  return count ? parseInt(count, 10) : 0;
}

/**
 * Resets the unread alert count for a user (called when they view alerts).
 */
export async function clearUnreadCount(
  userId: string,
  redis: Redis,
): Promise<void> {
  await redis.del(unreadCountKey(userId));
}

/**
 * Decrements the unread count by a specific amount (e.g., when a single
 * alert is acknowledged). The count never goes below zero.
 */
export async function decrementUnreadCount(
  userId: string,
  redis: Redis,
  amount = 1,
): Promise<void> {
  const current = await redis.get(unreadCountKey(userId));
  const currentCount = current ? parseInt(current, 10) : 0;
  const newCount = Math.max(0, currentCount - amount);

  if (newCount === 0) {
    await redis.del(unreadCountKey(userId));
  } else {
    await redis.set(unreadCountKey(userId), String(newCount));
  }
}
