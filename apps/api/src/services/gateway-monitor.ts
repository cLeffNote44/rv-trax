// ---------------------------------------------------------------------------
// RV Trax API — Background gateway monitoring service
// ---------------------------------------------------------------------------

import type { Database } from '@rv-trax/db';
import { gateways, alerts } from '@rv-trax/db';
import { eq } from 'drizzle-orm';
import type Redis from 'ioredis';
import type { FastifyBaseLogger } from 'fastify';
import { GatewayStatus, AlertSeverity, AlertStatus } from '@rv-trax/shared';

const GATEWAY_OFFLINE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
const CHECK_INTERVAL_MS = 60 * 1000; // 60 seconds

let monitorTimer: ReturnType<typeof setInterval> | null = null;
let _log: FastifyBaseLogger | null = null;

export function startGatewayMonitor(db: Database, redis: Redis, log: FastifyBaseLogger): void {
  if (monitorTimer) return;
  _log = log;

  monitorTimer = setInterval(async () => {
    try {
      await checkGateways(db, redis);
    } catch (err) {
      _log?.error({ err }, 'Gateway monitor check failed');
    }
  }, CHECK_INTERVAL_MS);

  log.info('Gateway monitor started (interval: 60s)');
}

export function stopGatewayMonitor(): void {
  if (monitorTimer) {
    clearInterval(monitorTimer);
    monitorTimer = null;
    _log?.info('Gateway monitor stopped');
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
