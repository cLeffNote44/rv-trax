// ---------------------------------------------------------------------------
// RV Trax API — Unit status change notification service
// ---------------------------------------------------------------------------
//
// Dispatches in-app and email notifications when a unit's status changes.
// Determines recipients by role based on the status transition category,
// and logs the change to the staff_activity_log table.
//
// Usage:
//   import { notifyStatusChange } from '../services/status-notifications.js';
//   await notifyStatusChange({ db, redis, log, dealershipId, unitId, userId, oldStatus, newStatus });
// ---------------------------------------------------------------------------

import type Redis from 'ioredis';
import type { Database } from '@rv-trax/db';
import {
  users as usersTable,
  units as unitsTable,
  staffActivityLog,
  dealerships as dealershipsTable,
} from '@rv-trax/db';
import { eq, and, inArray } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import { sendEmail } from './notifications/email.js';
import { sendInAppNotification } from './notifications/in-app.js';
import type { Alert } from '@rv-trax/shared';

// ── Types ───────────────────────────────────────────────────────────────────

export interface StatusChangeParams {
  db: Database;
  redis: Redis;
  log: FastifyBaseLogger;
  dealershipId: string;
  unitId: string;
  userId: string;
  oldStatus: string;
  newStatus: string;
}

interface RecipientRow {
  id: string;
  email: string;
  name: string;
  role: string;
}

// ── Status transition categories ────────────────────────────────────────────

/**
 * Maps status values to a notification category and the roles that should
 * be notified when a unit enters that status.
 */
const STATUS_NOTIFY_MAP: Record<string, { category: string; roles: string[] }> = {
  sold: { category: 'Sales', roles: ['owner', 'manager', 'sales'] },
  pending_delivery: { category: 'Sales', roles: ['owner', 'manager', 'sales'] },
  delivered: { category: 'Sales', roles: ['owner', 'manager', 'sales'] },
  in_service: { category: 'Service', roles: ['owner', 'manager', 'service'] },
  pdi_in_progress: { category: 'Service', roles: ['owner', 'manager', 'service'] },
  available: { category: 'Lot', roles: ['owner', 'manager', 'sales'] },
  lot_ready: { category: 'Lot', roles: ['owner', 'manager', 'sales'] },
};

// ── Human-readable labels ───────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  new_arrival: 'New Arrival',
  pdi_pending: 'PDI Pending',
  pdi_in_progress: 'PDI In Progress',
  lot_ready: 'Lot Ready',
  available: 'Available',
  hold: 'Hold',
  shown: 'Shown',
  deposit: 'Deposit',
  sold: 'Sold',
  pending_delivery: 'Pending Delivery',
  delivered: 'Delivered',
  in_service: 'In Service',
  wholesale: 'Wholesale',
  archived: 'Archived',
};

function statusLabel(status: string): string {
  return (
    STATUS_LABELS[status] ?? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// ── Main entry point ────────────────────────────────────────────────────────

/**
 * Notifies relevant users when a unit's status changes.
 *
 * - Resolves recipients by role within the dealership based on the new status
 * - Sends in-app notifications via Redis pub/sub
 * - Sends email notifications with a simple status-change email
 * - Logs the status change to staff_activity_log
 *
 * This function is fire-and-forget safe — it never throws. All errors are
 * logged but do not propagate to the caller.
 */
export async function notifyStatusChange(params: StatusChangeParams): Promise<void> {
  const { db, redis, log, dealershipId, unitId, userId, oldStatus, newStatus } = params;

  try {
    // ── 1. Log to staff_activity_log ──────────────────────────────────────
    await logStatusChange(db, { dealershipId, userId, unitId, oldStatus, newStatus });

    // ── 2. Determine if this transition warrants notifications ────────────
    const notifyConfig = STATUS_NOTIFY_MAP[newStatus];
    if (!notifyConfig) {
      log.debug({ unitId, newStatus }, 'Status change does not require notifications');
      return;
    }

    // ── 3. Fetch unit details for notification content ────────────────────
    const unit = await fetchUnit(db, unitId, dealershipId);
    if (!unit) {
      log.warn({ unitId, dealershipId }, 'Unit not found for status notification');
      return;
    }

    // ── 4. Resolve recipients by role (excluding the user who made the change)
    const recipients = await resolveRecipientsByRole(db, dealershipId, notifyConfig.roles, userId);

    if (recipients.length === 0) {
      log.debug(
        { unitId, newStatus, roles: notifyConfig.roles },
        'No recipients for status notification',
      );
      return;
    }

    // ── 5. Build notification content ────────────────────────────────────
    const title = `Unit ${unit.stockNumber} — ${statusLabel(newStatus)}`;
    const message = `Status changed from ${statusLabel(oldStatus)} to ${statusLabel(newStatus)}: ${unit.year} ${unit.make} ${unit.model}`;

    // Build a lightweight Alert-compatible object for in-app notifications
    const syntheticAlert: Alert = {
      id: crypto.randomUUID(),
      dealership_id: dealershipId,
      unit_id: unitId,
      title,
      message,
      severity: 'info',
      is_acknowledged: false,
      acknowledged_by: null,
      acknowledged_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // ── 6. Dispatch in-app notifications ─────────────────────────────────
    const inAppPromises = recipients.map((recipient) =>
      sendInAppNotification(syntheticAlert, recipient.id, redis).catch((err) => {
        log.error({ err, userId: recipient.id }, 'Failed to send in-app status notification');
      }),
    );

    // ── 7. Dispatch email notifications ──────────────────────────────────
    const dealership = await fetchDealership(db, dealershipId);
    const dealershipName = dealership?.name ?? 'Your Dealership';

    const emailPromises = recipients.map((recipient) => {
      const html = buildStatusChangeEmailHtml({
        recipientName: recipient.name,
        dealershipName,
        unitLabel: `${unit.stockNumber} — ${unit.year} ${unit.make} ${unit.model}`,
        oldStatus: statusLabel(oldStatus),
        newStatus: statusLabel(newStatus),
        unitId,
      });

      return sendEmail(recipient.email, `${title} — RV Trax`, html).catch((err) => {
        log.error({ err, userId: recipient.id }, 'Failed to send status change email');
      });
    });

    // Fire all dispatches in parallel
    await Promise.allSettled([...inAppPromises, ...emailPromises]);

    log.info(
      {
        unitId,
        oldStatus,
        newStatus,
        recipientCount: recipients.length,
        category: notifyConfig.category,
      },
      'Status change notifications dispatched',
    );
  } catch (err) {
    // Never let notification failures propagate — log and move on
    log.error({ err, unitId, oldStatus, newStatus }, 'Error in notifyStatusChange');
  }
}

// ── Activity log insertion ──────────────────────────────────────────────────

async function logStatusChange(
  db: Database,
  params: {
    dealershipId: string;
    userId: string;
    unitId: string;
    oldStatus: string;
    newStatus: string;
  },
): Promise<void> {
  await db.insert(staffActivityLog).values({
    dealershipId: params.dealershipId,
    userId: params.userId,
    action: 'changed_status',
    entityType: 'unit',
    entityId: params.unitId,
    metadata: {
      from_status: params.oldStatus,
      to_status: params.newStatus,
    },
  });
}

// ── Recipient resolution ────────────────────────────────────────────────────

async function resolveRecipientsByRole(
  db: Database,
  dealershipId: string,
  roles: string[],
  excludeUserId: string,
): Promise<RecipientRow[]> {
  const rows = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      role: usersTable.role,
    })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.dealershipId, dealershipId),
        eq(usersTable.isActive, true),
        inArray(usersTable.role, roles),
      ),
    );

  // Exclude the user who triggered the change — they don't need a notification
  return rows.filter((r) => r.id !== excludeUserId);
}

// ── Data fetchers ───────────────────────────────────────────────────────────

async function fetchUnit(
  db: Database,
  unitId: string,
  dealershipId: string,
): Promise<{
  stockNumber: string;
  year: number | null;
  make: string | null;
  model: string | null;
} | null> {
  const [row] = await db
    .select({
      stockNumber: unitsTable.stockNumber,
      year: unitsTable.year,
      make: unitsTable.make,
      model: unitsTable.model,
    })
    .from(unitsTable)
    .where(and(eq(unitsTable.id, unitId), eq(unitsTable.dealershipId, dealershipId)))
    .limit(1);

  return row ?? null;
}

async function fetchDealership(
  db: Database,
  dealershipId: string,
): Promise<{ name: string } | null> {
  const [row] = await db
    .select({ name: dealershipsTable.name })
    .from(dealershipsTable)
    .where(eq(dealershipsTable.id, dealershipId))
    .limit(1);

  return row ?? null;
}

// ── Email template ──────────────────────────────────────────────────────────

function buildStatusChangeEmailHtml(params: {
  recipientName: string;
  dealershipName: string;
  unitLabel: string;
  oldStatus: string;
  newStatus: string;
  unitId: string;
}): string {
  const { recipientName, dealershipName, unitLabel, oldStatus, newStatus, unitId } = params;
  const baseUrl = process.env['WEB_APP_URL'] ?? 'https://app.rvtrax.com';
  const unitUrl = `${baseUrl}/units/${unitId}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unit Status Changed</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F4F6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color:#1E3A5F;padding:24px 32px;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#FFFFFF;letter-spacing:-0.025em;">RV Trax</h1>
              <p style="margin:4px 0 0;font-size:14px;color:#93C5FD;">${dealershipName}</p>
            </td>
          </tr>

          <!-- Badge -->
          <tr>
            <td style="padding:24px 32px 0;">
              <span style="display:inline-block;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#3B82F6;background-color:#DBEAFE;">
                Status Change
              </span>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:16px 32px;">
              <p style="margin:0 0 12px;font-size:15px;color:#4B5563;line-height:1.6;">
                Hi ${recipientName},
              </p>
              <p style="margin:0 0 16px;font-size:15px;color:#4B5563;line-height:1.6;">
                A unit's status has been updated at ${dealershipName}.
              </p>

              <!-- Unit card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;margin:0 0 16px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="margin:0;font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;">Unit</p>
                    <p style="margin:4px 0 12px;font-size:16px;font-weight:600;color:#111827;">${unitLabel}</p>
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="font-size:13px;color:#6B7280;">Previous:</span>
                          <span style="display:inline-block;margin-left:8px;padding:2px 10px;border-radius:9999px;font-size:12px;font-weight:500;color:#DC2626;background-color:#FEE2E2;">${oldStatus}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:4px 0;">
                          <span style="font-size:13px;color:#6B7280;">Updated:</span>
                          <span style="display:inline-block;margin-left:8px;padding:2px 10px;border-radius:9999px;font-size:12px;font-weight:500;color:#059669;background-color:#D1FAE5;">${newStatus}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 24px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#1E3A5F;border-radius:8px;">
                    <a href="${unitUrl}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">View Unit</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F9FAFB;padding:20px 32px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">
                You are receiving this because you have status change notifications enabled.
                <a href="${baseUrl}/settings/notifications" style="color:#6B7280;text-decoration:underline;">Manage preferences</a>
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
