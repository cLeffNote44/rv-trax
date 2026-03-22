// ---------------------------------------------------------------------------
// RV Trax API — Push notification via Firebase Cloud Messaging
// ---------------------------------------------------------------------------

import admin from 'firebase-admin';
import type Redis from 'ioredis';
import type { Database } from '@rv-trax/db';
import { deviceTokens } from '@rv-trax/db';
import { eq, and, desc } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { FcmMessage, PushParams } from './types.js';

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

const TOKEN_CACHE_TTL = 86_400; // 24 hours

// ── Device token lookup ──────────────────────────────────────────────────────

async function getDeviceToken(
  userId: string,
  db: Database,
  redis: Redis,
): Promise<string | null> {
  const cacheKey = `device_token:${userId}`;

  const cached = await redis.get(cacheKey);
  if (cached) return cached;

  try {
    const rows = await db
      .select({ token: deviceTokens.token })
      .from(deviceTokens)
      .where(and(eq(deviceTokens.userId, userId), eq(deviceTokens.isActive, true)))
      .orderBy(desc(deviceTokens.createdAt))
      .limit(1);

    if (rows.length === 0) return null;

    const token = rows[0]!.token;
    await redis.set(cacheKey, token, 'EX', TOKEN_CACHE_TTL);
    return token;
  } catch {
    return null;
  }
}

async function removeDeviceToken(
  userId: string,
  token: string,
  db: Database,
  redis: Redis,
): Promise<void> {
  await redis.del(`device_token:${userId}`);

  try {
    await db
      .update(deviceTokens)
      .set({ isActive: false })
      .where(and(eq(deviceTokens.userId, userId), eq(deviceTokens.token, token)));
  } catch {
    // best effort
  }
}

// ── FCM Send ─────────────────────────────────────────────────────────────────

/**
 * Sends a push notification to a single user via Firebase Cloud Messaging.
 * Returns true on success, false on failure (no token, expired, FCM error, etc).
 */
export async function sendPushNotification(
  params: PushParams,
  db: Database,
  redis: Redis,
  log: FastifyBaseLogger,
): Promise<boolean> {
  const { userId, title, body, data, badge } = params;

  const token = await getDeviceToken(userId, db, redis);
  if (!token) return false;

  const message: FcmMessage = {
    token,
    notification: { title, body },
    data: {
      ...data,
      ...(badge !== undefined ? { badge: String(badge) } : {}),
    },
  };

  const messaging = getMessaging();
  if (!messaging) {
    if (process.env['NODE_ENV'] !== 'production') {
      log.info({ userId, title }, 'FCM not configured — skipping push in dev');
      return true;
    }
    log.error('FCM credentials not configured — cannot send push notifications');
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

    if (
      code === 'messaging/registration-token-not-registered' ||
      code === 'messaging/invalid-registration-token'
    ) {
      log.warn({ userId }, 'Device token expired, removing');
      await removeDeviceToken(userId, token, db, redis);
      return false;
    }

    log.error({ userId, err }, 'FCM send failed');
    return false;
  }
}
