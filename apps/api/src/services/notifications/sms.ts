// ---------------------------------------------------------------------------
// RV Trax API — SMS notification via Twilio
// ---------------------------------------------------------------------------
//
// Sends concise SMS alerts for critical and warning severity events.
// Requires env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.
// In non-production environments, SMS is logged but not sent when
// credentials are absent.
// ---------------------------------------------------------------------------

import Twilio from 'twilio';
import type { Alert } from '@rv-trax/shared';
import type { SmsParams } from './types.js';
import { getSeverityEmoji, truncate, getDashboardUrl } from './templates.js';

// ── Configuration ────────────────────────────────────────────────────────────

const TWILIO_ACCOUNT_SID = process.env['TWILIO_ACCOUNT_SID'] ?? '';
const TWILIO_AUTH_TOKEN = process.env['TWILIO_AUTH_TOKEN'] ?? '';
const TWILIO_FROM_NUMBER = process.env['TWILIO_FROM_NUMBER'] ?? '';

// ── Lazy Twilio client singleton ─────────────────────────────────────────────

let twilioClient: ReturnType<typeof Twilio> | null = null;

function getTwilioClient(): ReturnType<typeof Twilio> | null {
  if (twilioClient) return twilioClient;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return null;
  twilioClient = Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  return twilioClient;
}

/** Maximum SMS length before splitting into multiple segments. */
const SMS_MAX_LENGTH = 160;

// ── SMS message builders ─────────────────────────────────────────────────────

/**
 * Builds a concise SMS message for an alert.
 * Critical alerts include a short link; warnings are more compact.
 *
 * Format for critical:
 *   "[emoji] RV Trax ALERT: [title]. Unit [stock#]. [message]. View: [url]"
 *
 * Format for warning:
 *   "[emoji] RV Trax: [title]. [message]."
 */
export function buildAlertSmsMessage(
  alert: Alert,
  stockNumber?: string,
): string {
  const emoji = getSeverityEmoji(alert.severity);
  const shortUrl = getDashboardUrl(alert);

  if (alert.severity === 'critical') {
    const unitPart = stockNumber ? ` Unit ${stockNumber}.` : '';
    const msgPart = alert.message ? ` ${alert.message}` : '';
    const base = `${emoji} RV Trax ALERT: ${alert.title}.${unitPart}${msgPart} View: ${shortUrl}`;
    return truncate(base, SMS_MAX_LENGTH);
  }

  // Warning
  const msgPart = alert.message ? ` ${alert.message}` : '';
  const base = `${emoji} RV Trax: ${alert.title}.${msgPart}`;
  return truncate(base, SMS_MAX_LENGTH);
}

// ── Severity filter ──────────────────────────────────────────────────────────

/**
 * Returns true if SMS should be sent for this alert severity.
 * Only critical and warning alerts get SMS delivery.
 */
export function shouldSendSms(severity: string): boolean {
  return severity === 'critical' || severity === 'warning';
}

// ── Send SMS ─────────────────────────────────────────────────────────────────

/**
 * Sends an SMS via the Twilio REST API.
 * All SMS sends are logged for billing tracking.
 * Returns true on success, false on failure.
 */
export async function sendAlertSms(params: SmsParams): Promise<boolean> {
  const { to, message } = params;

  // Log every SMS attempt for billing tracking
  console.info(`[sms] Sending to=${to}, length=${message.length}`);

  const client = getTwilioClient();

  if (!client || !TWILIO_FROM_NUMBER) {
    if (process.env['NODE_ENV'] !== 'production') {
      console.info(`[sms] DEV SKIP — would send to=${to}: "${message}"`);
      return true;
    }
    console.error('[sms] Twilio credentials not configured');
    return false;
  }

  try {
    const result = await client.messages.create({
      to,
      from: TWILIO_FROM_NUMBER,
      body: message,
    });

    console.info(`[sms] Sent successfully, SID=${result.sid}`);
    return true;
  } catch (err) {
    console.error(`[sms] Twilio error sending to=${to}:`, err);
    return false;
  }
}
