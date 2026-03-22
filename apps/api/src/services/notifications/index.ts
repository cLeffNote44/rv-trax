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
import { users as usersTable, dealerships as dealershipsTable } from '@rv-trax/db';
import { eq, and, inArray } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
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
  log: FastifyBaseLogger,
  context?: AlertContext,
): Promise<NotificationResult[]> {
  const results: NotificationResult[] = [];

  const recipients = await resolveRecipients(rule, db, log);
  if (recipients.length === 0) {
    log.warn({ alertId: alert.id, ruleId: rule.id }, 'No recipients found for alert rule');
    return results;
  }

  const channels = parseChannels(rule.channels);
  if (channels.length === 0) {
    log.warn({ ruleId: rule.id }, 'No channels configured for alert rule');
    return results;
  }

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
          log,
          context,
        );
        results.push(result);
      } catch (err) {
        log.error({ alertId: alert.id, userId: user.id, channel, err }, 'Error dispatching notification');
        results.push({
          channel,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }
  }

  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  log.info(
    { alertId: alert.id, succeeded, failed, recipients: recipients.length, channels: channels.length },
    'Alert dispatch complete',
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
  log: FastifyBaseLogger,
): Promise<User[]> {
  const userMap = new Map<string, User>();

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
        log.error({ err, roles }, 'Error querying users by role');
      }
    }
  }

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
        log.error({ err, userIds }, 'Error querying users by ID');
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
  log: FastifyBaseLogger,
  context?: AlertContext,
): Promise<NotificationResult> {
  const rateLimit = await checkRateLimit(user.id, channel, redis);
  if (!rateLimit.allowed) {
    return {
      channel,
      success: false,
      error: `Rate limited (resets at ${rateLimit.resetAt})`,
    };
  }

  const channelEnabled = await isChannelEnabledForUser(user.id, channel, redis);
  if (!channelEnabled) {
    return {
      channel,
      success: false,
      error: `Channel ${channel} disabled for user`,
    };
  }

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

  switch (channel) {
    case 'in_app':
      return dispatchInApp(alert, user, redis);

    case 'push':
      return dispatchPush(alert, user, db, redis, log, context);

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
  log: FastifyBaseLogger,
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
    log,
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

async function lookupDealershipForUser(
  user: User,
  db: Database,
): Promise<import('@rv-trax/shared').Dealership | null> {
  try {
    const rows = await db
      .select()
      .from(dealershipsTable)
      .where(eq(dealershipsTable.id, user.dealership_id))
      .limit(1);

    if (rows.length === 0) return null;
    const row = rows[0]!;

    return {
      id: row.id,
      group_id: row.groupId ?? null,
      name: row.name,
      address: row.address,
      city: row.city,
      state: row.state,
      zip: row.zip,
      phone: null,
      timezone: row.timezone,
      subscription_tier: row.subscriptionTier as import('@rv-trax/shared').Dealership['subscription_tier'],
      subscription_status: row.subscriptionStatus as import('@rv-trax/shared').Dealership['subscription_status'],
      stripe_customer_id: row.stripeCustomerId ?? null,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
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
