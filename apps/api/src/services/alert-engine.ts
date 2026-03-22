// ---------------------------------------------------------------------------
// RV Trax API — Alert evaluation engine
// ---------------------------------------------------------------------------

import type { Database } from '@rv-trax/db';
import { alertRules, alerts } from '@rv-trax/db';
import { eq, and, gte } from 'drizzle-orm';
import type Redis from 'ioredis';
import type { FastifyBaseLogger } from 'fastify';
import { AlertSeverity, AlertStatus } from '@rv-trax/shared';
import { dispatchAlert } from './notifications/index.js';

// ── Alert trigger types ----------------------------------------------------

export type AlertTrigger =
  | {
      type: 'geofence_event';
      dealershipId: string;
      unitId: string;
      geoFenceId: string;
      eventType: 'enter' | 'exit';
    }
  | {
      type: 'movement';
      dealershipId: string;
      unitId: string;
      timestamp: string;
    }
  | {
      type: 'battery_low';
      dealershipId: string;
      trackerId: string;
      batteryPct: number;
    }
  | {
      type: 'tracker_offline';
      dealershipId: string;
      trackerId: string;
      lastSeenAt: string;
    }
  | {
      type: 'gateway_offline';
      dealershipId: string;
      gatewayId: string;
      lastSeenAt: string;
    }
  | {
      type: 'aged_inventory';
      dealershipId: string;
      unitId: string;
      daysOnLot: number;
    };

// ── Create alert params ----------------------------------------------------

export interface CreateAlertParams {
  dealershipId: string;
  ruleId: string;
  alertType: string;
  severity: string;
  title: string;
  message: string;
  unitId?: string | null;
  trackerId?: string | null;
  gatewayId?: string | null;
  geoFenceId?: string | null;
}

// ── Alert record returned from creation ------------------------------------

export interface AlertRecord {
  id: string;
  dealershipId: string;
  ruleId: string | null;
  alertType: string;
  severity: string;
  title: string;
  message: string | null;
  unitId: string | null;
  trackerId: string | null;
  gatewayId: string | null;
  geoFenceId: string | null;
  status: string;
  createdAt: Date;
}

// ── Deduplication constants ------------------------------------------------

/** Alerts with the same rule + entity within this window are considered duplicates. */
const DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// ── Core evaluation function -----------------------------------------------

/**
 * Evaluate all active alert rules for a given dealership against an incoming
 * trigger event. For each matching rule, check deduplication and create an
 * alert if none exists within the dedup window.
 *
 * Returns the list of newly created alerts.
 */
export async function evaluateAlertRules(
  event: AlertTrigger,
  db: Database,
  redis: Redis,
  log?: FastifyBaseLogger,
): Promise<AlertRecord[]> {
  // Fetch active alert rules for the dealership
  const rules = await db
    .select()
    .from(alertRules)
    .where(
      and(
        eq(alertRules.dealershipId, event.dealershipId),
        eq(alertRules.isActive, true),
      ),
    );

  const createdAlerts: AlertRecord[] = [];

  for (const rule of rules) {
    const match = evaluateRuleMatch(event, rule);
    if (!match) continue;

    // Deduplication: check if the same rule + entity combination fired recently
    const dedupKey = buildDedupKey(rule.id, event);
    const isDuplicate = await checkDuplicate(dedupKey, redis, db, rule.id, event);

    if (isDuplicate) continue;

    // Create the alert
    const alert = await createAlert(
      {
        dealershipId: event.dealershipId,
        ruleId: rule.id,
        alertType: rule.ruleType,
        severity: rule.severity,
        title: match.title,
        message: match.message,
        unitId: match.unitId ?? null,
        trackerId: match.trackerId ?? null,
        gatewayId: match.gatewayId ?? null,
        geoFenceId: match.geoFenceId ?? null,
      },
      db,
    );

    // Set dedup key in Redis (expire after window)
    try {
      await redis.set(dedupKey, '1', 'PX', DEDUP_WINDOW_MS);
    } catch {
      // Redis failure should not prevent alert creation; dedup is best-effort
    }

    createdAlerts.push(alert);

    // Dispatch notifications for this alert
    if (log) {
      try {
        await dispatchAlert(
          {
            id: alert.id,
            dealership_id: alert.dealershipId,
            alert_rule_id: alert.ruleId,
            severity: alert.severity as AlertSeverity,
            title: alert.title,
            message: alert.message ?? '',
            unit_id: alert.unitId,
            tracker_id: alert.trackerId,
            status: alert.status as AlertStatus,
            acknowledged_by: null,
            acknowledged_at: null,
            snoozed_until: null,
            created_at: alert.createdAt.toISOString(),
            updated_at: alert.createdAt.toISOString(),
          },
          {
            id: rule.id,
            dealershipId: rule.dealershipId,
            ruleType: rule.ruleType,
            severity: rule.severity,
            channels: rule.channels as string | null,
            recipientRoles: rule.recipientRoles as string | null,
            recipientUserIds: rule.recipientUserIds as string | null,
            isActive: rule.isActive,
          },
          db,
          redis,
          log,
        );
      } catch (err) {
        log.error({ alertId: alert.id, err }, 'Failed to dispatch notification for alert');
      }
    }
  }

  return createdAlerts;
}

// ── Rule matching logic ----------------------------------------------------

interface RuleMatchResult {
  title: string;
  message: string;
  unitId?: string;
  trackerId?: string;
  gatewayId?: string;
  geoFenceId?: string;
}

function evaluateRuleMatch(
  event: AlertTrigger,
  rule: { ruleType: string; parameters: unknown },
): RuleMatchResult | null {
  const params = (rule.parameters ?? {}) as Record<string, unknown>;

  switch (rule.ruleType) {
    // ── Geofence exit ──────────────────────────────────────────────────
    case 'geofence_exit': {
      if (event.type !== 'geofence_event' || event.eventType !== 'exit') {
        return null;
      }
      // If rule specifies a specific fence, check it matches
      if (params['geo_fence_id'] && params['geo_fence_id'] !== event.geoFenceId) {
        return null;
      }
      return {
        title: 'Unit exited geo-fence',
        message: `Unit ${event.unitId} exited geo-fence ${event.geoFenceId}`,
        unitId: event.unitId,
        geoFenceId: event.geoFenceId,
      };
    }

    // ── Geofence enter ─────────────────────────────────────────────────
    case 'geofence_enter': {
      if (event.type !== 'geofence_event' || event.eventType !== 'enter') {
        return null;
      }
      if (params['geo_fence_id'] && params['geo_fence_id'] !== event.geoFenceId) {
        return null;
      }
      return {
        title: 'Unit entered geo-fence',
        message: `Unit ${event.unitId} entered geo-fence ${event.geoFenceId}`,
        unitId: event.unitId,
        geoFenceId: event.geoFenceId,
      };
    }

    // ── After hours movement ───────────────────────────────────────────
    case 'after_hours_movement': {
      if (event.type !== 'movement') return null;

      const startHour = params['start_hour'] as number;
      const endHour = params['end_hour'] as number;
      const timezone = (params['timezone'] as string) || 'America/New_York';

      const now = new Date(event.timestamp);
      const currentHour = getHourInTimezone(now, timezone);

      // Check if current hour falls within the after-hours window.
      // The window can wrap around midnight (e.g., 22 -> 6).
      let isAfterHours: boolean;
      if (startHour <= endHour) {
        // Simple range, e.g., 0..6 (midnight to 6am)
        isAfterHours = currentHour >= startHour && currentHour < endHour;
      } else {
        // Wrapping range, e.g., 22..6 (10pm to 6am)
        isAfterHours = currentHour >= startHour || currentHour < endHour;
      }

      if (!isAfterHours) return null;

      return {
        title: 'After-hours movement detected',
        message: `Unit ${event.unitId} moved during restricted hours (${startHour}:00-${endHour}:00 ${timezone})`,
        unitId: event.unitId,
      };
    }

    // ── Aged inventory ─────────────────────────────────────────────────
    case 'aged_inventory': {
      if (event.type !== 'aged_inventory') return null;

      const daysThreshold = (params['days_threshold'] as number) ?? 90;
      if (event.daysOnLot < daysThreshold) return null;

      return {
        title: 'Aged inventory alert',
        message: `Unit ${event.unitId} has been on the lot for ${event.daysOnLot} days (threshold: ${daysThreshold})`,
        unitId: event.unitId,
      };
    }

    // ── Tracker battery low ────────────────────────────────────────────
    case 'tracker_battery_low': {
      if (event.type !== 'battery_low') return null;

      const thresholdPct = (params['threshold_pct'] as number) ?? 20;
      if (event.batteryPct >= thresholdPct) return null;

      return {
        title: 'Tracker battery low',
        message: `Tracker ${event.trackerId} battery at ${event.batteryPct}% (threshold: ${thresholdPct}%)`,
        trackerId: event.trackerId,
      };
    }

    // ── Tracker offline ────────────────────────────────────────────────
    case 'tracker_offline': {
      if (event.type !== 'tracker_offline') return null;

      const hoursThreshold = (params['hours_threshold'] as number) ?? 4;
      const lastSeen = new Date(event.lastSeenAt);
      const hoursSince = (Date.now() - lastSeen.getTime()) / (1000 * 60 * 60);

      if (hoursSince < hoursThreshold) return null;

      return {
        title: 'Tracker offline',
        message: `Tracker ${event.trackerId} has been offline for ${Math.round(hoursSince)} hours (threshold: ${hoursThreshold}h)`,
        trackerId: event.trackerId,
      };
    }

    // ── Gateway offline ────────────────────────────────────────────────
    case 'gateway_offline': {
      if (event.type !== 'gateway_offline') return null;

      const minutesThreshold = (params['minutes_threshold'] as number) ?? 5;
      const gwLastSeen = new Date(event.lastSeenAt);
      const minutesSince =
        (Date.now() - gwLastSeen.getTime()) / (1000 * 60);

      if (minutesSince < minutesThreshold) return null;

      return {
        title: 'Gateway offline',
        message: `Gateway ${event.gatewayId} has been offline for ${Math.round(minutesSince)} minutes (threshold: ${minutesThreshold}m)`,
        gatewayId: event.gatewayId,
      };
    }

    default:
      return null;
  }
}

// ── Create alert record ----------------------------------------------------

export async function createAlert(
  params: CreateAlertParams,
  db: Database,
): Promise<AlertRecord> {
  const [alert] = await db
    .insert(alerts)
    .values({
      dealershipId: params.dealershipId,
      ruleId: params.ruleId,
      alertType: params.alertType,
      severity: params.severity,
      title: params.title,
      message: params.message,
      unitId: params.unitId ?? null,
      trackerId: params.trackerId ?? null,
      gatewayId: params.gatewayId ?? null,
      geoFenceId: params.geoFenceId ?? null,
      status: 'new_alert',
    })
    .returning();

  return alert as unknown as AlertRecord;
}

// ── Deduplication helpers --------------------------------------------------

function buildDedupKey(ruleId: string, event: AlertTrigger): string {
  const entityPart = getEntityKey(event);
  return `alert-dedup:${ruleId}:${entityPart}`;
}

function getEntityKey(event: AlertTrigger): string {
  switch (event.type) {
    case 'geofence_event':
      return `unit:${event.unitId}:fence:${event.geoFenceId}:${event.eventType}`;
    case 'movement':
      return `unit:${event.unitId}:movement`;
    case 'battery_low':
      return `tracker:${event.trackerId}:battery`;
    case 'tracker_offline':
      return `tracker:${event.trackerId}:offline`;
    case 'gateway_offline':
      return `gateway:${event.gatewayId}:offline`;
    case 'aged_inventory':
      return `unit:${event.unitId}:aged`;
  }
}

/**
 * Check if a duplicate alert exists. Uses Redis first (fast path), falls back
 * to a DB query if Redis is unavailable.
 */
async function checkDuplicate(
  dedupKey: string,
  redis: Redis,
  db: Database,
  ruleId: string,
  event: AlertTrigger,
): Promise<boolean> {
  // Fast path: check Redis
  try {
    const cached = await redis.get(dedupKey);
    if (cached) return true;
  } catch {
    // Redis unavailable — fall through to DB check
  }

  // Slow path: check DB for recent alert with same rule + entity
  const since = new Date(Date.now() - DEDUP_WINDOW_MS);
  const conditions: ReturnType<typeof eq>[] = [
    eq(alerts.ruleId, ruleId),
    eq(alerts.dealershipId, event.dealershipId),
    gte(alerts.createdAt, since),
  ];

  // Add entity-specific condition
  switch (event.type) {
    case 'geofence_event':
    case 'movement':
    case 'aged_inventory':
      if ('unitId' in event && event.unitId) {
        conditions.push(eq(alerts.unitId, event.unitId));
      }
      break;
    case 'battery_low':
    case 'tracker_offline':
      conditions.push(eq(alerts.trackerId, event.trackerId));
      break;
    case 'gateway_offline':
      conditions.push(eq(alerts.gatewayId, event.gatewayId));
      break;
  }

  const [existing] = await db
    .select({ id: alerts.id })
    .from(alerts)
    .where(and(...conditions))
    .limit(1);

  return !!existing;
}

// ── Timezone helper --------------------------------------------------------

/**
 * Get the hour of day in a given IANA timezone. Uses Intl.DateTimeFormat
 * which is available in all modern Node.js runtimes.
 */
function getHourInTimezone(date: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const hourPart = parts.find((p) => p.type === 'hour');
    return parseInt(hourPart?.value ?? '0', 10);
  } catch {
    // Fallback to UTC if timezone is invalid
    return date.getUTCHours();
  }
}
