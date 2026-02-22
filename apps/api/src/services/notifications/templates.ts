// ---------------------------------------------------------------------------
// RV Trax API — Notification templates and helpers
// ---------------------------------------------------------------------------

import type { Alert } from '@rv-trax/shared';
import type { AlertContext } from './types.js';

// ── Alert Type Titles ────────────────────────────────────────────────────────

const ALERT_TITLES: Record<string, string> = {
  geofence_exit: 'Unit Left Lot Boundary',
  geofence_enter: 'Unit Entered Restricted Zone',
  after_hours_movement: 'After-Hours Movement Detected',
  aged_inventory: 'Aged Inventory Alert',
  tracker_battery_low: 'Tracker Battery Low',
  tracker_offline: 'Tracker Offline',
  gateway_offline: 'Gateway Offline',
  unauthorized_movement: 'Unauthorized Movement Detected',
  speed_violation: 'Speed Limit Exceeded',
  maintenance_due: 'Maintenance Due',
};

// ── Severity Emoji ───────────────────────────────────────────────────────────

const SEVERITY_EMOJI: Record<string, string> = {
  critical: '\u{1F6A8}',
  warning: '\u26A0\uFE0F',
  info: '\u2139\uFE0F',
};

// ── Public helpers ───────────────────────────────────────────────────────────

/**
 * Returns a human-readable title for an alert based on its alert_type.
 * Falls back to the alert's own title if the type is not recognized.
 */
export function getAlertTitle(alert: Alert): string {
  // The alert schema stores alert_type on the alert row itself.
  // Cast to access the alert_type field from the DB row.
  const alertType = (alert as unknown as Record<string, unknown>)['alert_type'] as
    | string
    | undefined;

  if (alertType) {
    const title = ALERT_TITLES[alertType];
    if (title) return title;
  }

  return alert.title;
}

/**
 * Builds a detailed human-readable message for an alert with contextual data.
 */
export function getAlertMessage(alert: Alert, context: AlertContext): string {
  const parts: string[] = [];

  // Base message from the alert
  if (alert.message) {
    parts.push(alert.message);
  }

  // Unit context
  if (context.unit) {
    parts.push(
      `Unit: ${context.unit.stock_number} (${context.unit.year} ${context.unit.make} ${context.unit.model})`,
    );

    if (context.unit.current_zone) {
      parts.push(`Location: Zone ${context.unit.current_zone}`);
    }
  }

  // Tracker context
  if (context.tracker) {
    if (context.tracker.battery_pct !== null) {
      parts.push(`Battery: ${context.tracker.battery_pct}%`);
    }

    if (context.tracker.last_seen_at) {
      const lastSeen = new Date(context.tracker.last_seen_at);
      const minutesAgo = Math.round(
        (Date.now() - lastSeen.getTime()) / 60_000,
      );

      if (minutesAgo > 60) {
        const hoursAgo = Math.round(minutesAgo / 60);
        parts.push(`Last seen: ${hoursAgo}h ago`);
      } else if (minutesAgo > 0) {
        parts.push(`Last seen: ${minutesAgo}m ago`);
      }
    }
  }

  // Gateway context
  if (context.gateway) {
    if (context.gateway.last_seen_at) {
      const lastSeen = new Date(context.gateway.last_seen_at);
      const minutesAgo = Math.round(
        (Date.now() - lastSeen.getTime()) / 60_000,
      );
      parts.push(`Gateway last seen: ${minutesAgo}m ago`);
    }
  }

  // GeoFence context
  if (context.geoFence) {
    parts.push(`Zone: ${context.geoFence.name}`);
  }

  return parts.join(' | ');
}

/**
 * Generates a deep link URL for the mobile app to navigate to the alert.
 */
export function getDeepLink(alert: Alert): string {
  if (alert.unit_id) {
    return `rvtrax://units/${alert.unit_id}`;
  }
  return `rvtrax://alerts/${alert.id}`;
}

/**
 * Returns the emoji for a given severity level.
 */
export function getSeverityEmoji(severity: string): string {
  return SEVERITY_EMOJI[severity] ?? '\u2139\uFE0F';
}

/**
 * Generates a short web dashboard URL for an alert.
 */
export function getDashboardUrl(alert: Alert): string {
  const baseUrl = process.env['WEB_APP_URL'] ?? 'https://app.rvtrax.com';
  return `${baseUrl}/alerts/${alert.id}`;
}

/**
 * Generates an unsubscribe URL for a user.
 */
export function getUnsubscribeUrl(userId: string): string {
  const baseUrl = process.env['WEB_APP_URL'] ?? 'https://app.rvtrax.com';
  return `${baseUrl}/settings/notifications?unsubscribe=${userId}`;
}

/**
 * Returns a CSS color for a severity level (for email templates).
 */
export function getSeverityColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return '#DC2626';
    case 'warning':
      return '#F59E0B';
    case 'info':
      return '#3B82F6';
    default:
      return '#6B7280';
  }
}

/**
 * Returns a background color for a severity level (for email badges).
 */
export function getSeverityBgColor(severity: string): string {
  switch (severity) {
    case 'critical':
      return '#FEE2E2';
    case 'warning':
      return '#FEF3C7';
    case 'info':
      return '#DBEAFE';
    default:
      return '#F3F4F6';
  }
}

/**
 * Truncates a string to a maximum length, adding ellipsis if needed.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + '\u2026';
}
