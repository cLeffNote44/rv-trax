// ---------------------------------------------------------------------------
// RV Trax API — Notification rate limiter
// ---------------------------------------------------------------------------

import type Redis from 'ioredis';
import type { RateLimitConfig, RateLimitResult } from './types.js';

// ── Rate limit configuration per channel ─────────────────────────────────────

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  push: { maxPerHour: 30 },
  email: { maxPerHour: 10 },
  sms: { maxPerHour: 5 },
  in_app: { maxPerHour: Infinity },
};

/** Sliding window size in seconds (1 hour). */
const WINDOW_SECONDS = 3600;

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the rate limit configuration for a given notification channel.
 */
export function getRateLimitConfig(channel: string): RateLimitConfig {
  return RATE_LIMITS[channel] ?? { maxPerHour: 0 };
}

/**
 * Checks whether a notification can be sent to a user on a given channel.
 *
 * Uses a sliding window counter pattern in Redis:
 *   Key:    ratelimit:notify:{userId}:{channel}
 *   Value:  count of notifications sent in the current window
 *   TTL:    resets every hour (aligned to the window start)
 *
 * If `in_app` channel, always allows (unlimited).
 */
export async function checkRateLimit(
  userId: string,
  channel: string,
  redis: Redis,
): Promise<RateLimitResult> {
  const config = getRateLimitConfig(channel);

  // In-app notifications are never rate-limited
  if (config.maxPerHour === Infinity) {
    return {
      allowed: true,
      remaining: Infinity,
      resetAt: new Date(Date.now() + WINDOW_SECONDS * 1000).toISOString(),
    };
  }

  // Unknown channel — deny
  if (config.maxPerHour === 0) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date().toISOString(),
    };
  }

  const key = `ratelimit:notify:${userId}:${channel}`;

  // Atomic increment + set expiry (only on first creation)
  const current = await redis.incr(key);
  if (current === 1) {
    // First notification in this window — set the TTL
    await redis.expire(key, WINDOW_SECONDS);
  }

  // Determine remaining TTL to compute the reset timestamp
  const ttl = await redis.ttl(key);
  const resetAt = new Date(
    Date.now() + (ttl > 0 ? ttl : WINDOW_SECONDS) * 1000,
  ).toISOString();

  const allowed = current <= config.maxPerHour;
  const remaining = Math.max(0, config.maxPerHour - current);

  // If we exceeded the limit, the INCR already happened. That is fine —
  // the next successful check after TTL expiry will reset the counter.
  // We do NOT decrement to keep the implementation simple and safe.

  return { allowed, remaining, resetAt };
}
