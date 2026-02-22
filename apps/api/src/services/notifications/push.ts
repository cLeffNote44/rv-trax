// ---------------------------------------------------------------------------
// RV Trax API — Push notification via Firebase Cloud Messaging (placeholder)
// ---------------------------------------------------------------------------
//
// This module provides the structure for sending push notifications through
// FCM HTTP v1. It is a placeholder implementation — no real FCM credentials
// are used. When real credentials become available, replace the fetch call
// with the Firebase Admin SDK or update the endpoint/auth header.
// ---------------------------------------------------------------------------

import admin from 'firebase-admin';
import type Redis from 'ioredis';
import type { Database } from '@rv-trax/db';
import type { FcmMessage, PushParams } from './types.js';
import { sql } from 'drizzle-orm';

// ── Firebase Admin initialization ────────────────────────────────────────────

let firebaseInitialized = false;

function getMessaging(): admin.messaging.Messaging | null {
  const projectId = process.env['FCM_PROJECT_ID'];
  const privateKey = process.env['FCM_PRIVATE_KEY'];
  const clientEmail = process.env['FCM_CLIENT_EMAIL'];

  if (!projectId || !privateKey || !clientEmail) return null;

  if (!firebaseInitialized) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        privateKey: privateKey.replace(/\\n/g, '\n'),
        clientEmail,
      }),
    });
    firebaseInitialized = true;
  }

  return admin.messaging();
}

// How long to cache a device token in Redis (24 hours)
const TOKEN_CACHE_TTL = 86_400;

// ── Device token lookup ──────────────────────────────────────────────────────

/**
 * Retrieves the device push token for a user.
 * Checks Redis cache first, then falls back to the database.
 * Returns null if no token is found (user has no registered device).
 */
async function getDeviceToken(
  userId: string,
  db: Database,
  redis: Redis,
): Promise<string | null> {
  const cacheKey = `device_token:${userId}`;

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return cached;
  }

  // Query the device_tokens table
  // Using raw SQL since the device_tokens table may not be in the Drizzle
  // schema yet. This is safe because userId is a UUID validated upstream.
  try {
    const result = await db.execute(sql`
      SELECT token FROM device_tokens
      WHERE user_id = ${userId} AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    `);

    const rows = (Array.isArray(result) ? result : (result as any).rows) as Array<{ token: string }> | undefined;
    if (!rows || rows.length === 0) {
      return null;
    }

    const firstRow = rows[0];
    if (!firstRow) return null;

    const token = firstRow.token;

    // Cache for future lookups
    await redis.set(cacheKey, token, 'EX', TOKEN_CACHE_TTL);

    return token;
  } catch {
    // Table may not exist yet — return null gracefully
    return null;
  }
}

/**
 * Removes an expired/invalid device token from the cache and database.
 */
async function removeDeviceToken(
  userId: string,
  token: string,
  db: Database,
  redis: Redis,
): Promise<void> {
  const cacheKey = `device_token:${userId}`;
  await redis.del(cacheKey);

  try {
    await db.execute(sql`
      UPDATE device_tokens SET is_active = false
      WHERE user_id = ${userId} AND token = ${token}
    `);
  } catch {
    // Best effort — table may not exist yet
  }
}

// ── FCM Send ─────────────────────────────────────────────────────────────────

/**
 * Sends a push notification to a single user via Firebase Cloud Messaging.
 *
 * **Placeholder implementation**: The actual HTTP call to FCM is structured
 * correctly but will fail without valid OAuth2 credentials. Replace the
 * Authorization header with a real service account token or use the
 * Firebase Admin SDK when integrating.
 *
 * Returns true on success, false on failure (token expired, rate limited, etc).
 */
export async function sendPushNotification(
  params: PushParams,
  db: Database,
  redis: Redis,
): Promise<boolean> {
  const { userId, title, body, data, badge } = params;

  // Look up the user's device token
  const token = await getDeviceToken(userId, db, redis);
  if (!token) {
    // User has no registered device — not an error, just skip
    return false;
  }

  // Build the FCM message
  const message: FcmMessage = {
    token,
    notification: { title, body },
    data: {
      ...data,
      ...(badge !== undefined ? { badge: String(badge) } : {}),
    },
  };

  // ── Send via Firebase Admin SDK ─────────────────────────────────────────

  const messaging = getMessaging();
  if (!messaging) {
    if (process.env['NODE_ENV'] !== 'production') {
      console.info(
        `[push] DEV SKIP — would send to user=${userId}: "${title}"`,
      );
      return true;
    }
    console.error('[push] FCM credentials not configured');
    return false;
  }

  try {
    await messaging.send({
      token: message.token,
      notification: message.notification,
      data: message.data,
    });
    return true;
  } catch (err: any) {
    const code = err?.code ?? '';

    // Handle expired / invalid token
    if (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token'
    ) {
      console.warn(
        `[push] Token expired for user=${userId}, removing token`,
      );
      await removeDeviceToken(userId, token, db, redis);
      return false;
    }

    console.error(`[push] FCM error for user=${userId}:`, err);
    return false;
  }
}
