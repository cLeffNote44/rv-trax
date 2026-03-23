// ---------------------------------------------------------------------------
// RV Trax API — Email via Resend (alternative to AWS SES)
// ---------------------------------------------------------------------------
//
// Resend (https://resend.com) is a modern email API with better DX,
// deliverability dashboards, and simpler setup than SES.
//
// Set EMAIL_PROVIDER=resend and RESEND_API_KEY in your environment to use.
// Falls back to SES when not configured.
// ---------------------------------------------------------------------------

const RESEND_API_KEY = process.env['RESEND_API_KEY'] ?? '';
const RESEND_FROM =
  process.env['RESEND_FROM_ADDRESS'] ??
  process.env['SES_FROM_ADDRESS'] ??
  'RV Trax <alerts@notifications.rvtrax.com>';

/**
 * Sends an email via the Resend HTTP API.
 * No SDK dependency required — uses a single fetch call.
 */
export async function sendEmailViaResend(
  to: string,
  subject: string,
  htmlBody: string,
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    if (process.env['NODE_ENV'] !== 'production') {
      console.warn(`[email:resend] DEV SKIP — would send to=${to}: "${subject}"`);
      return true;
    }
    console.error('[email:resend] RESEND_API_KEY not configured');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [to],
        subject,
        html: htmlBody,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`[email:resend] API error ${response.status}: ${body}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error(`[email:resend] Network error sending to=${to}:`, err);
    return false;
  }
}

/**
 * Check if Resend is configured and should be used as the email provider.
 */
export function isResendConfigured(): boolean {
  return process.env['EMAIL_PROVIDER'] === 'resend' && RESEND_API_KEY.length > 0;
}
