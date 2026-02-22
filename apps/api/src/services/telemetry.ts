// ---------------------------------------------------------------------------
// RV Trax API — Gateway telemetry ingestion service
// ---------------------------------------------------------------------------

import type { Database } from '@rv-trax/db';
import { gateways, gatewayTelemetry, alerts } from '@rv-trax/db';
import { eq } from 'drizzle-orm';
import { GatewayStatus, AlertSeverity } from '@rv-trax/shared';
import type Redis from 'ioredis';

// ── Types ------------------------------------------------------------------

export interface GatewayTelemetryData {
  cpu_temp_c?: number;
  memory_used_pct?: number;
  backhaul_latency_ms?: number;
  packets_received?: number;
  packets_forwarded?: number;
}

/**
 * Process incoming telemetry from a gateway.
 *
 * 1. Validate that the gateway exists (by EUI).
 * 2. Insert the telemetry record.
 * 3. Update gateway.last_seen_at.
 * 4. If the gateway was offline, trigger recovery (update status + create alert).
 */
export async function processTelemetry(
  gatewayEui: string,
  data: GatewayTelemetryData,
  db: Database,
  redis?: Redis,
): Promise<{ success: boolean; gatewayId?: string; error?: string }> {
  // ── 1. Look up gateway by EUI ----------------------------------------------
  const [gw] = await db
    .select()
    .from(gateways)
    .where(eq(gateways.gatewayEui, gatewayEui))
    .limit(1);

  if (!gw) {
    return { success: false, error: `Unknown gateway EUI: ${gatewayEui}` };
  }

  const now = new Date();

  // ── 2. Insert telemetry record ---------------------------------------------
  await db.insert(gatewayTelemetry).values({
    time: now,
    gatewayId: gw.id,
    cpuTempC: data.cpu_temp_c?.toString() ?? null,
    memoryUsedPct: data.memory_used_pct?.toString() ?? null,
    backhaulLatencyMs: data.backhaul_latency_ms?.toString() ?? null,
    packetsReceived: data.packets_received ?? null,
    packetsForwarded: data.packets_forwarded ?? null,
  });

  // ── 3. Update last_seen_at --------------------------------------------------
  await db
    .update(gateways)
    .set({ lastSeenAt: now })
    .where(eq(gateways.id, gw.id));

  // ── 4. Recovery check: if status was offline, transition to online ----------
  if (gw.status === GatewayStatus.OFFLINE) {
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
      message: `Gateway ${gw.gatewayEui} is back online (telemetry received).`,
      gatewayId: gw.id,
      status: 'new',
    });

    // Broadcast recovery event via Redis pub/sub
    if (redis) {
      const channel = `dealership:${gw.dealershipId}:locations`;
      const event = JSON.stringify({
        type: 'gateway_status',
        gateway_id: gw.id,
        status: 'online',
      });
      await redis.publish(channel, event).catch(() => { /* swallow */ });
    }
  }

  return { success: true, gatewayId: gw.id };
}
