// ---------------------------------------------------------------------------
// RV Trax API — Background gateway monitoring service
// ---------------------------------------------------------------------------

import type { Database } from '@rv-trax/db';
import { gateways, alerts } from '@rv-trax/db';
import { eq } from 'drizzle-orm';
import type Redis from 'ioredis';
import { GatewayStatus, AlertSeverity, AlertStatus } from '@rv-trax/shared';

// ── Configuration ----------------------------------------------------------

/** If a gateway has not been seen for this long, consider it offline. */
const GATEWAY_OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/** How often to check gateways. */
const CHECK_INTERVAL_MS = 60 * 1000; // 60 seconds

let monitorTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the background gateway monitor.
 * Every CHECK_INTERVAL_MS it checks all gateways and transitions them
 * between online/offline states, creating alerts as appropriate.
 */
export function startGatewayMonitor(db: Database, redis: Redis): void {
  if (monitorTimer) {
    return; // Already running
  }

  monitorTimer = setInterval(async () => {
    try {
      await checkGateways(db, redis);
    } catch (err) {
      // Log but do not crash the interval
      console.error('[gateway-monitor] Error during gateway check:', err);
    }
  }, CHECK_INTERVAL_MS);

  console.log('[gateway-monitor] Started (interval: 60s)');
}

/**
 * Stop the background gateway monitor.
 */
export function stopGatewayMonitor(): void {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
    console.log('[gateway-monitor] Stopped');
  }
}

// ── Core check logic -------------------------------------------------------

async function checkGateways(db: Database, redis: Redis): Promise<void> {
  const now = new Date();
  const threshold = new Date(now.getTime() - GATEWAY_OFFLINE_THRESHOLD_MS);

  // Fetch all gateways
  const allGateways = await db.select().from(gateways);

  for (const gw of allGateways) {
    const lastSeen = gw.lastSeenAt;
    const isStale = !lastSeen || lastSeen <= threshold;
    const currentStatus = gw.status;

    // ── Transition online -> offline -----------------------------------------
    if (isStale && currentStatus === GatewayStatus.ONLINE) {
      // Mark offline
      await db
        .update(gateways)
        .set({ status: GatewayStatus.OFFLINE })
        .where(eq(gateways.id, gw.id));

      // Create alert
      await db.insert(alerts).values({
        dealershipId: gw.dealershipId,
        alertType: 'gateway_offline',
        severity: AlertSeverity.CRITICAL,
        title: `Gateway offline: ${gw.name ?? gw.gatewayEui}`,
        message: `Gateway ${gw.gatewayEui} has not been seen since ${lastSeen?.toISOString() ?? 'never'}.`,
        gatewayId: gw.id,
        status: AlertStatus.NEW_ALERT,
      });

      // Broadcast gateway_status event via Redis pub/sub
      const channel = `dealership:${gw.dealershipId}:locations`;
      const event = JSON.stringify({
        type: 'gateway_status',
        gateway_id: gw.id,
        status: 'offline',
      });
      await redis.publish(channel, event).catch(() => { /* swallow */ });

      continue;
    }

    // ── Transition offline -> online -----------------------------------------
    if (!isStale && currentStatus === GatewayStatus.OFFLINE) {
      // Mark online
      await db
        .update(gateways)
        .set({ status: GatewayStatus.ONLINE })
        .where(eq(gateways.id, gw.id));

      // Create recovery alert
      await db.insert(alerts).values({
        dealershipId: gw.dealershipId,
        alertType: 'gateway_recovery',
        severity: AlertSeverity.INFO,
        title: `Gateway recovered: ${gw.name ?? gw.gatewayEui}`,
        message: `Gateway ${gw.gatewayEui} is back online.`,
        gatewayId: gw.id,
        status: AlertStatus.NEW_ALERT,
      });

      // Broadcast gateway_status event via Redis pub/sub
      const channel = `dealership:${gw.dealershipId}:locations`;
      const event = JSON.stringify({
        type: 'gateway_status',
        gateway_id: gw.id,
        status: 'online',
      });
      await redis.publish(channel, event).catch(() => { /* swallow */ });
    }
  }
}
