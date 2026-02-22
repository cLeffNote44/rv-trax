// ---------------------------------------------------------------------------
// RV Trax API — Digest mode for batching non-critical alerts
// ---------------------------------------------------------------------------
//
// Instead of sending every info/warning alert immediately, digest mode
// collects them into a per-user daily list in Redis. A scheduled job
// calls `processDigests()` to build and send summary emails.
// ---------------------------------------------------------------------------

import type Redis from 'ioredis';
import type { Database } from '@rv-trax/db';
import type { Alert, Dealership } from '@rv-trax/shared';
import type { DigestEntry } from './types.js';
import { sendEmail } from './email.js';
import {
  getSeverityColor,
  getSeverityEmoji,
  getUnsubscribeUrl,
} from './templates.js';
import { sql } from 'drizzle-orm';

// ── Configuration ────────────────────────────────────────────────────────────

/** Time-to-live for digest lists in Redis (48 hours). */
const DIGEST_TTL_SECONDS = 48 * 60 * 60;

// ── Redis Key Helpers ────────────────────────────────────────────────────────

function digestKey(userId: string, date: string): string {
  return `digest:${userId}:${date}`;
}

function todayDateString(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// ── Queue for Digest ─────────────────────────────────────────────────────────

/**
 * Adds an alert to the user's daily digest list in Redis.
 * The list will auto-expire after 48 hours.
 */
export async function queueForDigest(
  alert: Alert,
  userId: string,
  redis: Redis,
): Promise<void> {
  const date = todayDateString();
  const key = digestKey(userId, date);

  const entry: DigestEntry = {
    alert,
    timestamp: new Date().toISOString(),
  };

  const pipeline = redis.pipeline();
  pipeline.rpush(key, JSON.stringify(entry));
  pipeline.expire(key, DIGEST_TTL_SECONDS);
  await pipeline.exec();
}

// ── Process Digests ──────────────────────────────────────────────────────────

/**
 * Processes all pending digest lists and sends summary emails.
 *
 * Called by a scheduled job (e.g., once per hour or at a dealership-
 * configured time). For each user with queued alerts:
 *   1. Retrieves all alerts in the digest
 *   2. Builds a summary email
 *   3. Sends the email
 *   4. Clears the digest list
 *
 * This function scans for digest keys using SCAN to avoid blocking Redis.
 */
export async function processDigests(
  db: Database,
  redis: Redis,
): Promise<void> {
  const date = todayDateString();
  const pattern = `digest:*:${date}`;

  let cursor = '0';
  const processedKeys: string[] = [];

  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      pattern,
      'COUNT',
      100,
    );
    cursor = nextCursor;

    for (const key of keys) {
      try {
        await processDigestForKey(key, db, redis);
        processedKeys.push(key);
      } catch (err) {
        console.error(`[digest] Error processing ${key}:`, err);
        // Continue with other users even if one fails
      }
    }
  } while (cursor !== '0');

  if (processedKeys.length > 0) {
    console.info(
      `[digest] Processed ${processedKeys.length} digest(s) for ${date}`,
    );
  }
}

/**
 * Processes a single user's digest list.
 */
async function processDigestForKey(
  key: string,
  db: Database,
  redis: Redis,
): Promise<void> {
  // Parse userId from key format: digest:{userId}:{date}
  const parts = key.split(':');
  if (parts.length < 3) return;
  const userId = parts[1] as string;

  // Get all entries in the list
  const rawEntries = await redis.lrange(key, 0, -1);
  if (rawEntries.length === 0) return;

  // Parse entries
  const entries: DigestEntry[] = rawEntries
    .map((raw) => {
      try {
        return JSON.parse(raw) as DigestEntry;
      } catch {
        return null;
      }
    })
    .filter((e): e is DigestEntry => e !== null);

  if (entries.length === 0) {
    await redis.del(key);
    return;
  }

  // Look up user and dealership
  const userRow = await lookupUser(userId, db);
  if (!userRow) {
    console.warn(`[digest] User ${userId} not found, clearing digest`);
    await redis.del(key);
    return;
  }

  const dealershipRow = await lookupDealership(userRow.dealershipId, db);
  if (!dealershipRow) {
    console.warn(
      `[digest] Dealership ${userRow.dealershipId} not found, clearing digest`,
    );
    await redis.del(key);
    return;
  }

  // Build the dealership object matching the shared interface
  const dealership: Dealership = {
    id: dealershipRow['id'] as string,
    group_id: (dealershipRow['groupId'] as string) ?? null,
    name: dealershipRow['name'] as string,
    address: dealershipRow['address'] as string,
    city: dealershipRow['city'] as string,
    state: dealershipRow['state'] as string,
    zip: dealershipRow['zip'] as string,
    phone: null,
    timezone: dealershipRow['timezone'] as string,
    subscription_tier: dealershipRow['subscriptionTier'] as Dealership['subscription_tier'],
    subscription_status: dealershipRow['subscriptionStatus'] as Dealership['subscription_status'],
    stripe_customer_id: (dealershipRow['stripeCustomerId'] as string) ?? null,
    created_at: dealershipRow['createdAt'] ? (dealershipRow['createdAt'] as Date).toISOString() : '',
    updated_at: dealershipRow['updatedAt'] ? (dealershipRow['updatedAt'] as Date).toISOString() : '',
  };

  const alerts = entries.map((e) => e.alert);

  // Build and send the digest email using the dedicated digest template
  const digestHtml = buildDigestEmail(alerts, userRow, dealership);
  const subject = `${getSeverityEmoji('info')} Your Daily RV Trax Summary — ${entries.length} alert(s)`;

  const sent = await sendEmail(userRow.email, subject, digestHtml);

  if (sent) {
    // Clear the processed digest
    await redis.del(key);
  } else {
    console.warn(
      `[digest] Failed to send digest email to ${userRow.email}, keeping list for retry`,
    );
  }
}

// ── Digest Email Builder ─────────────────────────────────────────────────────

/**
 * Builds an HTML digest email summarizing multiple alerts.
 */
export function buildDigestEmail(
  alerts: Alert[],
  user: { name: string; email: string },
  dealership: Dealership,
): string {
  // Count by severity
  const counts: Record<string, number> = { critical: 0, warning: 0, info: 0 };
  for (const alert of alerts) {
    const sev = alert.severity;
    counts[sev] = (counts[sev] ?? 0) + 1;
  }

  // Build alert rows
  const alertRows = alerts
    .slice(0, 25) // Cap at 25 to keep email reasonable
    .map((alert) => {
      const time = new Date(alert.created_at).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
      const color = getSeverityColor(alert.severity);
      const emoji = getSeverityEmoji(alert.severity);
      return `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#6B7280;">${time}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;">
            <span style="color:${color};font-weight:600;font-size:13px;">${emoji} ${alert.severity}</span>
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#111827;">${alert.title}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;color:#6B7280;">${alert.message ?? ''}</td>
        </tr>`;
    })
    .join('');

  const moreCount = alerts.length > 25 ? alerts.length - 25 : 0;
  const moreRow = moreCount > 0
    ? `<tr><td colspan="4" style="padding:12px;text-align:center;font-size:13px;color:#6B7280;">
        ... and ${moreCount} more alert(s)
       </td></tr>`
    : '';

  const baseUrl = process.env['WEB_APP_URL'] ?? 'https://app.rvtrax.com';
  const unsubscribeUrl = getUnsubscribeUrl(user.email);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Daily RV Trax Summary</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F4F6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color:#1E3A5F;padding:24px 32px;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#FFFFFF;">RV Trax</h1>
              <p style="margin:4px 0 0;font-size:14px;color:#93C5FD;">${dealership.name}</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:24px 32px;">
              <h2 style="margin:0;font-size:20px;font-weight:600;color:#111827;">Your Daily RV Trax Summary</h2>
              <p style="margin:8px 0 0;font-size:15px;color:#4B5563;">
                Hi ${user.name}, here's a summary of today's alerts for ${dealership.name}.
              </p>
            </td>
          </tr>

          <!-- Severity Summary -->
          <tr>
            <td style="padding:0 32px;">
              <table width="100%" cellpadding="0" cellspacing="8" style="margin-bottom:16px;">
                <tr>
                  <td style="background:#FEE2E2;border-radius:8px;padding:12px 16px;text-align:center;width:33%;">
                    <p style="margin:0;font-size:24px;font-weight:700;color:#DC2626;">${counts['critical']}</p>
                    <p style="margin:2px 0 0;font-size:12px;color:#991B1B;text-transform:uppercase;">Critical</p>
                  </td>
                  <td style="background:#FEF3C7;border-radius:8px;padding:12px 16px;text-align:center;width:33%;">
                    <p style="margin:0;font-size:24px;font-weight:700;color:#D97706;">${counts['warning']}</p>
                    <p style="margin:2px 0 0;font-size:12px;color:#92400E;text-transform:uppercase;">Warning</p>
                  </td>
                  <td style="background:#DBEAFE;border-radius:8px;padding:12px 16px;text-align:center;width:33%;">
                    <p style="margin:0;font-size:24px;font-weight:700;color:#2563EB;">${counts['info']}</p>
                    <p style="margin:2px 0 0;font-size:12px;color:#1E40AF;text-transform:uppercase;">Info</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Alert Table -->
          <tr>
            <td style="padding:0 32px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
                <tr style="background:#F9FAFB;">
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6B7280;font-weight:600;text-transform:uppercase;border-bottom:1px solid #E5E7EB;">Time</th>
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6B7280;font-weight:600;text-transform:uppercase;border-bottom:1px solid #E5E7EB;">Severity</th>
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6B7280;font-weight:600;text-transform:uppercase;border-bottom:1px solid #E5E7EB;">Alert</th>
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6B7280;font-weight:600;text-transform:uppercase;border-bottom:1px solid #E5E7EB;">Details</th>
                </tr>
                ${alertRows}
                ${moreRow}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:8px 32px 24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#1E3A5F;border-radius:8px;">
                    <a href="${baseUrl}/alerts" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">
                      View All Alerts
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F9FAFB;padding:20px 32px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">
                You are receiving this digest because you have digest mode enabled for ${dealership.name}.
                <a href="${unsubscribeUrl}" style="color:#6B7280;text-decoration:underline;">Unsubscribe</a>
                or manage your
                <a href="${baseUrl}/settings/notifications" style="color:#6B7280;text-decoration:underline;">notification preferences</a>.
              </p>
              <p style="margin:8px 0 0;font-size:12px;color:#D1D5DB;">
                &copy; ${new Date().getFullYear()} RV Trax. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Database Lookups ─────────────────────────────────────────────────────────

/**
 * Looks up a user by ID from the database.
 * Returns a minimal record with fields needed for digest emails.
 */
async function lookupUser(
  userId: string,
  db: Database,
): Promise<{ id: string; email: string; name: string; dealershipId: string } | null> {
  try {
    const result = await db.execute(sql`
      SELECT id, email, name, dealership_id
      FROM users
      WHERE id = ${userId} AND is_active = true
      LIMIT 1
    `);

    const rows = (Array.isArray(result) ? result : (result as any).rows) as
      Array<{ id: string; email: string; name: string; dealership_id: string }> | undefined;
    if (!rows || rows.length === 0) return null;

    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      dealershipId: row.dealership_id,
    };
  } catch {
    return null;
  }
}

/**
 * Looks up a dealership by ID from the database.
 */
async function lookupDealership(
  dealershipId: string,
  db: Database,
): Promise<Record<string, unknown> | null> {
  try {
    const result = await db.execute(sql`
      SELECT * FROM dealerships WHERE id = ${dealershipId} LIMIT 1
    `);

    const rows = (Array.isArray(result) ? result : (result as any).rows) as
      Array<Record<string, unknown>> | undefined;
    if (!rows || rows.length === 0) return null;
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
