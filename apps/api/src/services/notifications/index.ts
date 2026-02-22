// ---------------------------------------------------------------------------
// RV Trax API — Notification dispatcher (main entry point)
// ---------------------------------------------------------------------------
//
// Orchestrates alert delivery across all channels: push, email, SMS,
// and in-app. Handles recipient resolution, rate limiting, digest mode,
// and per-channel dispatch.
// ---------------------------------------------------------------------------

import type Redis from 'ioredis';
import type { Database } from '@rv-trax/db';
import { users as usersTable } from '@rv-trax/db';
import { eq, and, inArray, sql } from 'drizzle-orm';
import type { Alert, User } from '@rv-trax/shared';
import { AlertSeverity } from '@rv-trax/shared';
import type { NotificationResult, AlertContext } from './types.js';
import { checkRateLimit } from './rate-limiter.js';
import { sendPushNotification } from './push.js';
import { sendAlertEmail, buildAlertEmailSubject } from './email.js';
import { buildAlertSmsMessage, shouldSendSms } from './sms.js';
import { sendInAppNotification } from './in-app.js';
import { queueForDigest } from './digest.js';
import { getAlertTitle, getAlertMessage, getDeepLink } from './templates.js';

// ── Types for the alert rule shape from the DB ───────────────────────────────

interface AlertRuleRow {
  id: string;
  dealershipId: string;
  ruleType: string;
  severity: string;
  channels: string | null;
  recipientRoles: string | null;
  recipientUserIds: string | null;
  isActive: boolean;
}

// ── Main Dispatcher ──────────────────────────────────────────────────────────

/**
 * Dispatches an alert to all appropriate recipients across all configured
 * channels. This is the single entry point for the notification system.
 *
 * Flow:
 *   1. Resolve recipients from the rule (by role and/or explicit user IDs)
 *   2. For each recipient + each channel:
 *      a. Check rate limit
 *      b. Check if channel is enabled for the user
 *      c. For non-critical alerts: check digest mode preference
 *      d. Dispatch via the appropriate channel handler
 *   3. Log results and any failures
 */
export async function dispatchAlert(
  alert: Alert,
  rule: AlertRuleRow,
  db: Database,
  redis: Redis,
  context?: AlertContext,
): Promise<NotificationResult[]> {
  const results: NotificationResult[] = [];

  // 1. Resolve recipients
  const recipients = await resolveRecipients(rule, db);
  if (recipients.length === 0) {
    console.warn(
      `[notify] No recipients found for alert=${alert.id} rule=${rule.id}`,
    );
    return results;
  }

  // 2. Parse channels from the rule
  const channels = parseChannels(rule.channels);
  if (channels.length === 0) {
    console.warn(
      `[notify] No channels configured for rule=${rule.id}`,
    );
    return results;
  }

  // 3. Dispatch to each recipient on each channel
  for (const user of recipients) {
    for (const channel of channels) {
      try {
        const result = await dispatchToRecipient(
          alert,
          rule,
          user,
          channel,
          db,
          redis,
          context,
        );
        results.push(result);
      } catch (err) {
        console.error(
          `[notify] Error dispatching alert=${alert.id} to user=${user.id} channel=${channel}:`,
          err,
        );
        results.push({
          channel,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  }

  // 4. Log summary
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.info(
    `[notify] Alert ${alert.id}: dispatched ${succeeded} ok, ${failed} failed, ${recipients.length} recipients, ${channels.length} channels`,
  );

  return results;
}

// ── Recipient Resolution ─────────────────────────────────────────────────────

/**
 * Resolves the list of users who should receive this notification.
 *
 * - If `recipientRoles` is set: query all active users in the dealership
 *   with those roles
 * - If `recipientUserIds` is set: include those specific users
 * - Deduplicates by user ID
 */
async function resolveRecipients(
  rule: AlertRuleRow,
  db: Database,
): Promise<User[]> {
  const userMap = new Map<string, User>();

  // Resolve by role
  if (rule.recipientRoles) {
    const roles = parseCommaSeparated(rule.recipientRoles);
    if (roles.length > 0) {
      try {
        const roleUsers = await db
          .select()
          .from(usersTable)
          .where(
            and(
              eq(usersTable.dealershipId, rule.dealershipId),
              eq(usersTable.isActive, true),
              inArray(usersTable.role, roles),
            ),
          );

        for (const row of roleUsers) {
          const user = mapDbUserToUser(row);
          userMap.set(user.id, user);
        }
      } catch (err) {
        console.error('[notify] Error querying users by role:', err);
      }
    }
  }

  // Resolve by explicit user IDs
  if (rule.recipientUserIds) {
    const userIds = parseCommaSeparated(rule.recipientUserIds);
    if (userIds.length > 0) {
      try {
        const explicitUsers = await db
          .select()
          .from(usersTable)
          .where(
            and(
              eq(usersTable.isActive, true),
              inArray(usersTable.id, userIds),
            ),
          );

        for (const row of explicitUsers) {
          const user = mapDbUserToUser(row);
          userMap.set(user.id, user);
        }
      } catch (err) {
        console.error('[notify] Error querying users by ID:', err);
      }
    }
  }

  return Array.from(userMap.values());
}

// ── Per-Recipient Dispatch ───────────────────────────────────────────────────

/**
 * Dispatches an alert to a single recipient on a single channel.
 */
async function dispatchToRecipient(
  alert: Alert,
  _rule: AlertRuleRow,
  user: User,
  channel: string,
  db: Database,
  redis: Redis,
  context?: AlertContext,
): Promise<NotificationResult> {
  // Check rate limit (except in_app which is unlimited)
  const rateLimit = await checkRateLimit(user.id, channel, redis);
  if (!rateLimit.allowed) {
    return {
      channel,
      success: false,
      error: `Rate limited (resets at ${rateLimit.resetAt})`,
    };
  }

  // Check if user has channel enabled (user preferences stored in Redis)
  const channelEnabled = await isChannelEnabledForUser(user.id, channel, redis);
  if (!channelEnabled) {
    return {
      channel,
      success: false,
      error: `Channel ${channel} disabled for user`,
    };
  }

  // For non-critical alerts, check digest mode preference
  if (
    alert.severity !== AlertSeverity.CRITICAL &&
    channel === 'email'
  ) {
    const digestEnabled = await isDigestEnabled(user.id, redis);
    if (digestEnabled) {
      await queueForDigest(alert, user.id, redis);
      return {
        channel: 'digest',
        success: true,
      };
    }
  }

  // Dispatch based on channel
  switch (channel) {
    case 'in_app':
      return dispatchInApp(alert, user, redis);

    case 'push':
      return dispatchPush(alert, user, db, redis, context);

    case 'email':
      return dispatchEmail(alert, user, db, redis, context);

    case 'sms':
      return dispatchSms(alert, user, redis, context);

    default:
      return {
        channel,
        success: false,
        error: `Unknown channel: ${channel}`,
      };
  }
}

// ── Channel Dispatchers ──────────────────────────────────────────────────────

async function dispatchInApp(
  alert: Alert,
  user: User,
  redis: Redis,
): Promise<NotificationResult> {
  await sendInAppNotification(alert, user.id, redis);
  return { channel: 'in_app', success: true };
}

async function dispatchPush(
  alert: Alert,
  user: User,
  db: Database,
  redis: Redis,
  context?: AlertContext,
): Promise<NotificationResult> {
  const title = getAlertTitle(alert);
  const body = context ? getAlertMessage(alert, context) : alert.message;
  const deepLink = getDeepLink(alert);

  const success = await sendPushNotification(
    {
      userId: user.id,
      title,
      body,
      data: {
        alert_id: alert.id,
        unit_id: alert.unit_id ?? '',
        type: (alert as unknown as Record<string, unknown>)['alert_type'] as string ?? '',
        deep_link: deepLink,
      },
    },
    db,
    redis,
  );

  return { channel: 'push', success };
}

async function dispatchEmail(
  alert: Alert,
  user: User,
  db: Database,
  _redis: Redis,
  context?: AlertContext,
): Promise<NotificationResult> {
  // Look up dealership for the email template
  const dealership = context?.dealership ?? await lookupDealershipForUser(user, db);
  if (!dealership) {
    return { channel: 'email', success: false, error: 'Dealership not found' };
  }

  const subject = buildAlertEmailSubject(alert);

  const success = await sendAlertEmail({
    to: user.email,
    subject,
    alert,
    unit: context?.unit,
    tracker: context?.tracker,
    gateway: context?.gateway,
    dealership,
  });

  return { channel: 'email', success };
}

async function dispatchSms(
  alert: Alert,
  user: User,
  redis: Redis,
  context?: AlertContext,
): Promise<NotificationResult> {
  // Only send SMS for critical and warning
  if (!shouldSendSms(alert.severity)) {
    return {
      channel: 'sms',
      success: false,
      error: `SMS not sent for ${alert.severity} severity`,
    };
  }

  // Look up user's phone number from Redis or skip if not available
  const phone = await getUserPhone(user.id, redis);
  if (!phone) {
    return {
      channel: 'sms',
      success: false,
      error: 'No phone number on file',
    };
  }

  const stockNumber = context?.unit?.stock_number;
  const message = buildAlertSmsMessage(alert, stockNumber);

  const { sendAlertSms: sendSms } = await import('./sms.js');
  const success = await sendSms({ to: phone, message });

  return { channel: 'sms', success };
}

// ── Preference Lookups ───────────────────────────────────────────────────────

/**
 * Checks if a specific notification channel is enabled for a user.
 * User preferences are stored in Redis as `user:{userId}:prefs:channels`.
 * If no preference exists, all channels are enabled by default.
 */
async function isChannelEnabledForUser(
  userId: string,
  channel: string,
  redis: Redis,
): Promise<boolean> {
  const prefsKey = `user:${userId}:prefs:channels`;
  const disabled = await redis.sismember(prefsKey, `disabled:${channel}`);
  return disabled === 0; // 0 means NOT in the set = enabled
}

/**
 * Checks if digest mode is enabled for a user.
 */
async function isDigestEnabled(
  userId: string,
  redis: Redis,
): Promise<boolean> {
  const key = `user:${userId}:prefs:digest`;
  const value = await redis.get(key);
  return value === '1' || value === 'true';
}

/**
 * Gets a user's phone number from Redis cache.
 */
async function getUserPhone(
  userId: string,
  redis: Redis,
): Promise<string | null> {
  return redis.get(`user:${userId}:phone`);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parses a comma-separated string into an array of trimmed, non-empty strings.
 */
function parseCommaSeparated(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Parses the channels field from an alert rule.
 * Supports comma-separated string or JSON array string.
 */
function parseChannels(channels: string | null): string[] {
  if (!channels) return [];

  // Try JSON array first
  if (channels.startsWith('[')) {
    try {
      const parsed = JSON.parse(channels);
      if (Array.isArray(parsed)) {
        return parsed.map(String).filter((s) => s.length > 0);
      }
    } catch {
      // Fall through to comma-separated
    }
  }

  return parseCommaSeparated(channels);
}

/**
 * Maps a Drizzle user row to the shared User interface.
 */
function mapDbUserToUser(row: Record<string, unknown>): User {
  return {
    id: row['id'] as string,
    dealership_id: row['dealershipId'] as string,
    email: row['email'] as string,
    name: row['name'] as string,
    role: row['role'] as User['role'],
    avatar_url: (row['avatarUrl'] as string) ?? null,
    is_active: row['isActive'] as boolean,
    last_login_at: row['lastLoginAt']
      ? (row['lastLoginAt'] as Date).toISOString()
      : null,
    created_at: (row['createdAt'] as Date).toISOString(),
    updated_at: (row['updatedAt'] as Date).toISOString(),
  };
}

/**
 * Looks up a dealership for a user to populate email templates.
 */
async function lookupDealershipForUser(
  user: User,
  db: Database,
): Promise<import('@rv-trax/shared').Dealership | null> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM dealerships WHERE id = ${user.dealership_id} LIMIT 1
    `);

    const rows = (Array.isArray(result) ? result : (result as any).rows) as
      Array<Record<string, unknown>> | undefined;
    if (!rows || rows.length === 0) return null;

    const row = rows[0];
    if (!row) return null;

    return {
      id: row['id'] as string,
      group_id: (row['group_id'] as string) ?? null,
      name: row['name'] as string,
      address: row['address'] as string,
      city: row['city'] as string,
      state: row['state'] as string,
      zip: row['zip'] as string,
      phone: null,
      timezone: row['timezone'] as string,
      subscription_tier: row['subscription_tier'] as import('@rv-trax/shared').Dealership['subscription_tier'],
      subscription_status: row['subscription_status'] as import('@rv-trax/shared').Dealership['subscription_status'],
      stripe_customer_id: (row['stripe_customer_id'] as string) ?? null,
      created_at: row['created_at'] ? String(row['created_at']) : '',
      updated_at: row['updated_at'] ? String(row['updated_at']) : '',
    };
  } catch {
    return null;
  }
}

// ── Re-exports ───────────────────────────────────────────────────────────────

export { checkRateLimit, getRateLimitConfig } from './rate-limiter.js';
export { sendPushNotification } from './push.js';
export { sendAlertEmail, sendEmail, sendInviteEmail, sendReportEmail, buildAlertEmailHtml, buildAlertEmailSubject } from './email.js';
export { sendAlertSms, buildAlertSmsMessage, shouldSendSms } from './sms.js';
export { sendInAppNotification, getUnreadCount, clearUnreadCount, decrementUnreadCount } from './in-app.js';
export { queueForDigest, processDigests, buildDigestEmail } from './digest.js';
export {
  getAlertTitle,
  getAlertMessage,
  getDeepLink,
  getSeverityEmoji,
  getDashboardUrl,
  getUnsubscribeUrl,
} from './templates.js';
export type {
  PushParams,
  EmailParams,
  SmsParams,
  NotificationResult,
  DigestEntry,
  AlertContext,
  RateLimitResult,
  InAppPayload,
} from './types.js';
