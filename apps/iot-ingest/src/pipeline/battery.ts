// ---------------------------------------------------------------------------
// @rv-trax/iot-ingest — Pipeline Step 2: Battery monitoring
// ---------------------------------------------------------------------------

import { eq, and, gte } from 'drizzle-orm';
import type { Redis } from 'ioredis';
import { trackers, alerts, type Database } from '@rv-trax/db';
import { DEFAULT_BATTERY_ALERT_PCT } from '@rv-trax/shared';
import type { TrackerLookup } from './types.js';

/**
 * Update tracker battery/signal fields and generate low-battery alerts
 * when the percentage drops below the dealership threshold.
 *
 * Steps:
 * 1. Write battery_pct, battery_mv, signal_rssi, last_seen_at to trackers table
 * 2. Determine threshold from dealership settings (fallback to DEFAULT_BATTERY_ALERT_PCT)
 * 3. If below threshold: check for existing alert in last 24h to avoid duplicates
 * 4. If no recent alert: insert new alert, publish to Redis pub/sub
 */
export async function checkBattery(
  lookup: TrackerLookup,
  batteryMv: number,
  batteryPct: number,
  rssi: number,
  db: Database,
  redis: Redis,
): Promise<string | null> {
  const { tracker, dealership, unit } = lookup;

  // 1. Update tracker telemetry fields
  await db
    .update(trackers)
    .set({
      batteryPct,
      batteryMv: batteryMv,
      signalRssi: rssi,
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(trackers.id, tracker.id));

  // 2. Determine battery threshold
  const settings = dealership.settings ?? {};
  const threshold =
    typeof settings.battery_alert_pct === 'number'
      ? settings.battery_alert_pct
      : DEFAULT_BATTERY_ALERT_PCT;

  // 3. Check if battery is below threshold
  if (batteryPct >= threshold) {
    return null; // Battery is fine
  }

  // 4. Check for existing alert in last 24 hours to avoid duplicates
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const existingAlerts = await db
    .select({ id: alerts.id })
    .from(alerts)
    .where(
      and(
        eq(alerts.trackerId, tracker.id),
        eq(alerts.alertType, 'tracker_battery_low'),
        gte(alerts.createdAt, twentyFourHoursAgo),
      ),
    )
    .limit(1);

  if (existingAlerts.length > 0) {
    return null; // Already alerted recently
  }

  // 5. Insert new alert
  const title = `Low battery on tracker ${tracker.deviceEui}`;
  const message = `Tracker battery at ${batteryPct}% (${batteryMv}mV) — threshold is ${threshold}%. Unit: ${unit.stockNumber}`;

  const insertedAlerts = await db
    .insert(alerts)
    .values({
      dealershipId: dealership.id,
      alertType: 'tracker_battery_low',
      severity: 'warning',
      title,
      message,
      unitId: unit.id,
      trackerId: tracker.id,
      status: 'new',
    })
    .returning({ id: alerts.id });

  const alertId = insertedAlerts[0]?.id ?? null;

  // 6. Publish alert event to Redis pub/sub
  if (alertId) {
    const alertPayload = JSON.stringify({
      id: alertId,
      type: 'tracker_battery_low',
      severity: 'warning',
      title,
      message,
      trackerId: tracker.id,
      unitId: unit.id,
      batteryPct,
      batteryMv,
      timestamp: new Date().toISOString(),
    });

    await redis.publish(`alerts:${dealership.id}`, alertPayload).catch((err) => {
      console.error('[battery] Failed to publish alert to Redis:', err);
    });
  }

  return alertId;
}
