// ---------------------------------------------------------------------------
// RV Trax API — Email notification via AWS SES
// ---------------------------------------------------------------------------
//
// Builds HTML emails and sends them through AWS SES v2.
// Requires env vars: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_SES_REGION.
// In non-production environments, emails are logged but not sent when
// credentials are absent.
// ---------------------------------------------------------------------------

import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import type { Alert } from '@rv-trax/shared';
import type { EmailParams } from './types.js';
import {
  getDashboardUrl,
  getSeverityBgColor,
  getSeverityColor,
  getSeverityEmoji,
  getUnsubscribeUrl,
} from './templates.js';
import { isResendConfigured, sendEmailViaResend } from './email-resend.js';

// ── Configuration ────────────────────────────────────────────────────────────

const SES_REGION = process.env['AWS_SES_REGION'] ?? 'us-east-1';
const SES_FROM = process.env['SES_FROM_ADDRESS'] ?? 'alerts@notifications.rvtrax.com';

// ── Lazy SES client singleton ────────────────────────────────────────────────

let sesClient: SESv2Client | null = null;

function getSesClient(): SESv2Client | null {
  if (sesClient) return sesClient;

  const accessKey = process.env['AWS_ACCESS_KEY_ID'];
  const secretKey = process.env['AWS_SECRET_ACCESS_KEY'];

  if (!accessKey || !secretKey) return null;

  sesClient = new SESv2Client({ region: SES_REGION });
  return sesClient;
}

// ── Email HTML Builder ───────────────────────────────────────────────────────

/**
 * Builds a complete HTML email for an alert notification.
 */
export function buildAlertEmailHtml(params: EmailParams): string {
  const { alert, unit, tracker, gateway, dealership } = params;

  const severityColor = getSeverityColor(alert.severity);
  const severityBg = getSeverityBgColor(alert.severity);
  const emoji = getSeverityEmoji(alert.severity);
  const dashboardUrl = getDashboardUrl(alert);
  const unsubscribeUrl = getUnsubscribeUrl(params.to);

  // Build optional unit details card
  let unitCard = '';
  if (unit) {
    unitCard = `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;margin:16px 0;padding:16px;">
        <tr>
          <td style="padding:8px 16px;">
            <p style="margin:0;font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;">Unit Details</p>
            <p style="margin:4px 0 0;font-size:16px;font-weight:600;color:#111827;">
              ${unit.stock_number} &mdash; ${unit.year} ${unit.make} ${unit.model}
            </p>
            ${unit.current_zone ? `<p style="margin:4px 0 0;font-size:14px;color:#6B7280;">Location: Zone ${unit.current_zone}${unit.current_row ? `, Row ${unit.current_row}` : ''}${unit.current_spot ? `, Spot ${unit.current_spot}` : ''}</p>` : ''}
          </td>
        </tr>
      </table>`;
  }

  // Build optional tracker details
  let trackerCard = '';
  if (tracker) {
    trackerCard = `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;margin:16px 0;padding:16px;">
        <tr>
          <td style="padding:8px 16px;">
            <p style="margin:0;font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;">Tracker Details</p>
            <p style="margin:4px 0 0;font-size:14px;color:#111827;">
              Device EUI: <strong>${tracker.device_eui}</strong>
            </p>
            ${tracker.battery_pct !== null ? `<p style="margin:4px 0 0;font-size:14px;color:#111827;">Battery: <strong>${tracker.battery_pct}%</strong></p>` : ''}
            ${tracker.last_seen_at ? `<p style="margin:4px 0 0;font-size:14px;color:#6B7280;">Last seen: ${new Date(tracker.last_seen_at).toLocaleString()}</p>` : ''}
          </td>
        </tr>
      </table>`;
  }

  // Build optional gateway details
  let gatewayCard = '';
  if (gateway) {
    gatewayCard = `
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-radius:8px;margin:16px 0;padding:16px;">
        <tr>
          <td style="padding:8px 16px;">
            <p style="margin:0;font-size:12px;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;">Gateway Details</p>
            <p style="margin:4px 0 0;font-size:14px;color:#111827;">
              ${gateway.label ?? gateway.device_eui} &mdash; ${gateway.status}
            </p>
          </td>
        </tr>
      </table>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F4F6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background-color:#1E3A5F;padding:24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin:0;font-size:24px;font-weight:700;color:#FFFFFF;letter-spacing:-0.025em;">
                      RV Trax
                    </h1>
                    <p style="margin:4px 0 0;font-size:14px;color:#93C5FD;">
                      ${dealership.name}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Severity Badge -->
          <tr>
            <td style="padding:24px 32px 0;">
              <span style="display:inline-block;padding:4px 12px;border-radius:9999px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:${severityColor};background-color:${severityBg};">
                ${emoji} ${alert.severity}
              </span>
            </td>
          </tr>

          <!-- Alert Title & Message -->
          <tr>
            <td style="padding:16px 32px;">
              <h2 style="margin:0;font-size:20px;font-weight:600;color:#111827;">
                ${alert.title}
              </h2>
              ${alert.message ? `<p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#4B5563;">${alert.message}</p>` : ''}
            </td>
          </tr>

          <!-- Unit / Tracker / Gateway Cards -->
          <tr>
            <td style="padding:0 32px;">
              ${unitCard}
              ${trackerCard}
              ${gatewayCard}
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding:24px 32px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#1E3A5F;border-radius:8px;">
                    <a href="${dashboardUrl}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#FFFFFF;text-decoration:none;">
                      View in Dashboard
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Timestamp -->
          <tr>
            <td style="padding:0 32px 24px;">
              <p style="margin:0;font-size:13px;color:#9CA3AF;">
                Alert generated at ${new Date(alert.created_at).toLocaleString()} (${dealership.timezone})
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F9FAFB;padding:20px 32px;border-top:1px solid #E5E7EB;">
              <p style="margin:0;font-size:12px;color:#9CA3AF;line-height:1.6;">
                You are receiving this because you have alert notifications enabled for ${dealership.name}.
                <a href="${unsubscribeUrl}" style="color:#6B7280;text-decoration:underline;">Unsubscribe</a>
                or manage your
                <a href="${process.env['WEB_APP_URL'] ?? 'https://app.rvtrax.com'}/settings/notifications" style="color:#6B7280;text-decoration:underline;">notification preferences</a>.
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

// ── Send Email ───────────────────────────────────────────────────────────────

/**
 * Sends an alert email via AWS SES.
 * Returns true on success, false on failure.
 */
export async function sendAlertEmail(params: EmailParams): Promise<boolean> {
  const html = buildAlertEmailHtml(params);
  return sendEmail(params.to, params.subject, html);
}

/**
 * Generic email sender — used by alert emails and password reset.
 */
export async function sendEmail(to: string, subject: string, htmlBody: string): Promise<boolean> {
  // Use Resend if configured as the email provider
  if (isResendConfigured()) {
    return sendEmailViaResend(to, subject, htmlBody);
  }

  // Otherwise fall back to AWS SES
  const client = getSesClient();

  if (!client) {
    if (process.env['NODE_ENV'] !== 'production') {
      console.warn(`[email] DEV SKIP — would send to=${to}: "${subject}"`);
      return true;
    }
    console.error(
      '[email] No email provider configured (set EMAIL_PROVIDER=resend or add AWS SES credentials)',
    );
    return false;
  }

  try {
    await client.send(
      new SendEmailCommand({
        FromEmailAddress: SES_FROM,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: 'UTF-8' },
            Body: { Html: { Data: htmlBody, Charset: 'UTF-8' } },
          },
        },
      }),
    );
    return true;
  } catch (err) {
    console.error(`[email] SES error sending to=${to}:`, err);
    return false;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a subject line for an alert email.
 */
export function buildAlertEmailSubject(alert: Alert): string {
  const emoji = getSeverityEmoji(alert.severity);
  return `${emoji} ${alert.title} — RV Trax Alert`;
}

// ── Invite Email ─────────────────────────────────────────────────────────────

/**
 * Sends an invitation email to a new user being added to a dealership.
 */
export async function sendInviteEmail(params: {
  to: string;
  inviterName: string;
  dealershipName: string;
  role: string;
  inviteToken: string;
}): Promise<boolean> {
  const { to, inviterName, dealershipName, role, inviteToken } = params;
  const baseUrl = process.env['WEB_APP_URL'] ?? 'https://app.rvtrax.com';
  const acceptUrl = `${baseUrl}/accept-invite?token=${inviteToken}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>You're invited to RV Trax</title></head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <tr><td style="background-color:#1E3A5F;padding:24px 32px;">
          <h1 style="margin:0;font-size:24px;font-weight:700;color:#fff;">RV Trax</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 12px;font-size:20px;color:#111827;">You've been invited!</h2>
          <p style="margin:0 0 8px;font-size:15px;color:#4B5563;line-height:1.6;">
            <strong>${inviterName}</strong> has invited you to join
            <strong>${dealershipName}</strong> on RV Trax as a <strong>${role}</strong>.
          </p>
          <p style="margin:0 0 24px;font-size:15px;color:#4B5563;line-height:1.6;">
            Click the button below to create your account and get started.
          </p>
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background-color:#1E3A5F;border-radius:8px;">
              <a href="${acceptUrl}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;">Accept Invitation</a>
            </td>
          </tr></table>
          <p style="margin:24px 0 0;font-size:13px;color:#9CA3AF;">This invitation expires in 7 days. If you didn't expect this, you can safely ignore it.</p>
        </td></tr>
        <tr><td style="background:#F9FAFB;padding:16px 32px;border-top:1px solid #E5E7EB;">
          <p style="margin:0;font-size:12px;color:#D1D5DB;">&copy; ${new Date().getFullYear()} RV Trax. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return sendEmail(to, `You're invited to join ${dealershipName} on RV Trax`, html);
}

// ── Report Email ─────────────────────────────────────────────────────────────

/**
 * Sends a scheduled report as an email with a download link.
 */
export async function sendReportEmail(params: {
  to: string;
  userName: string;
  reportName: string;
  dealershipName: string;
  downloadUrl: string;
  summary?: string;
}): Promise<boolean> {
  const { to, userName, reportName, dealershipName, downloadUrl, summary } = params;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${reportName}</title></head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <tr><td style="background-color:#1E3A5F;padding:24px 32px;">
          <h1 style="margin:0;font-size:24px;font-weight:700;color:#fff;">RV Trax</h1>
          <p style="margin:4px 0 0;font-size:14px;color:#93C5FD;">${dealershipName}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="margin:0 0 12px;font-size:20px;color:#111827;">Your Report is Ready</h2>
          <p style="margin:0 0 8px;font-size:15px;color:#4B5563;line-height:1.6;">
            Hi ${userName}, your scheduled report <strong>${reportName}</strong> has been generated.
          </p>
          ${summary ? `<p style="margin:0 0 16px;font-size:14px;color:#6B7280;line-height:1.5;background:#F9FAFB;padding:12px 16px;border-radius:8px;border:1px solid #E5E7EB;">${summary}</p>` : ''}
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background-color:#1E3A5F;border-radius:8px;">
              <a href="${downloadUrl}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#fff;text-decoration:none;">Download Report</a>
            </td>
          </tr></table>
          <p style="margin:24px 0 0;font-size:13px;color:#9CA3AF;">This download link expires in 24 hours.</p>
        </td></tr>
        <tr><td style="background:#F9FAFB;padding:16px 32px;border-top:1px solid #E5E7EB;">
          <p style="margin:0;font-size:12px;color:#D1D5DB;">&copy; ${new Date().getFullYear()} RV Trax. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return sendEmail(to, `${reportName} — RV Trax Report`, html);
}
