// ---------------------------------------------------------------------------
// @rv-trax/iot-ingest — ChirpStack payload parser / normalizer
// ---------------------------------------------------------------------------

import type { TrackerEvent } from '../types.js';

// ── ChirpStack v4 uplink payload structures ─────────────────────────────────

interface ChirpStackRxInfo {
  gatewayId: string;
  rssi: number;
  snr: number;
}

interface ChirpStackDeviceInfo {
  devEui: string;
  deviceProfileName: string;
  applicationId: string;
}

interface ChirpStackDecodedObject {
  latitude?: number;
  longitude?: number;
  altitude?: number;
  battery?: number;
  batteryVoltage?: number;
  motion?: boolean;
}

interface ChirpStackUplink {
  deduplicationId: string;
  time: string;
  deviceInfo: ChirpStackDeviceInfo;
  rxInfo: ChirpStackRxInfo[];
  txInfo: { frequency: number };
  object?: ChirpStackDecodedObject;
  data?: string; // base64 encoded raw payload
}

// ── Topic parsing ───────────────────────────────────────────────────────────

/**
 * Extract the event type from a ChirpStack MQTT topic.
 * Topic format: application/{app_id}/device/{dev_eui}/event/{event_type}
 */
function parseEventType(topic: string): string | null {
  const parts = topic.split('/');
  // Expected: ['application', appId, 'device', devEui, 'event', eventType]
  if (parts.length < 6 || parts[0] !== 'application' || parts[4] !== 'event') {
    return null;
  }
  return parts[5] ?? null;
}

/**
 * Extract the device EUI from a ChirpStack MQTT topic.
 */
function parseDeviceEuiFromTopic(topic: string): string | null {
  const parts = topic.split('/');
  if (parts.length < 4 || parts[0] !== 'application' || parts[2] !== 'device') {
    return null;
  }
  return parts[3] ?? null;
}

// ── Best gateway selection ──────────────────────────────────────────────────

interface BestGateway {
  gatewayId: string;
  rssi: number;
  snr: number;
}

function selectBestGateway(rxInfo: ChirpStackRxInfo[]): BestGateway {
  if (rxInfo.length === 0) {
    return { gatewayId: 'unknown', rssi: -999, snr: -99 };
  }

  let best = rxInfo[0]!;
  for (let i = 1; i < rxInfo.length; i++) {
    const entry = rxInfo[i]!;
    if (entry.rssi > best.rssi) {
      best = entry;
    }
  }

  return {
    gatewayId: best.gatewayId,
    rssi: best.rssi,
    snr: best.snr,
  };
}

// ── Battery normalization ───────────────────────────────────────────────────

/**
 * Normalize battery information from the decoded object.
 * Handles both percentage (0-100) and voltage (mV or V) representations.
 */
function normalizeBattery(obj: ChirpStackDecodedObject | undefined): {
  battery_mv: number;
  battery_pct: number;
} {
  if (!obj) {
    return { battery_mv: 0, battery_pct: 0 };
  }

  let mv = 0;
  let pct = 0;

  // batteryVoltage is typically in volts; battery could be percentage or voltage
  if (obj.batteryVoltage !== undefined) {
    // If value is small (< 10), it is in volts — convert to mV
    mv = obj.batteryVoltage < 10 ? Math.round(obj.batteryVoltage * 1000) : Math.round(obj.batteryVoltage);
  }

  if (obj.battery !== undefined) {
    if (obj.battery <= 100) {
      // Looks like a percentage
      pct = Math.round(obj.battery);
      if (mv === 0) {
        // Approximate mV from percentage (LiPo: 3000-4200 mV range)
        mv = Math.round(3000 + (pct / 100) * 1200);
      }
    } else {
      // Looks like millivolts
      mv = Math.round(obj.battery);
    }
  }

  // If we have mV but no pct, estimate percentage (LiPo linear approx)
  if (mv > 0 && pct === 0) {
    pct = Math.max(0, Math.min(100, Math.round(((mv - 3000) / 1200) * 100)));
  }

  return { battery_mv: mv, battery_pct: pct };
}

// ── Main normalizer ─────────────────────────────────────────────────────────

/**
 * Normalize a ChirpStack MQTT or webhook event into a unified TrackerEvent.
 *
 * @param topic   - MQTT topic string (used to extract event type and device EUI)
 * @param payload - Raw MQTT message buffer (JSON)
 * @returns Normalized TrackerEvent or null if the event should be ignored
 */
export function normalizeChirpStackEvent(
  topic: string,
  payload: Buffer,
): TrackerEvent | null {
  const eventType = parseEventType(topic);

  // Only process uplink events — status and join events are informational
  if (eventType !== 'up') {
    return null;
  }

  let uplink: ChirpStackUplink;
  try {
    uplink = JSON.parse(payload.toString('utf-8')) as ChirpStackUplink;
  } catch {
    return null;
  }

  // Validate minimum required fields
  if (!uplink.deviceInfo?.devEui || !uplink.deduplicationId || !uplink.time) {
    return null;
  }

  // Prefer device EUI from payload; fall back to topic
  const deviceEui =
    uplink.deviceInfo.devEui.toLowerCase() ??
    parseDeviceEuiFromTopic(topic)?.toLowerCase();

  if (!deviceEui) {
    return null;
  }

  const bestGw = selectBestGateway(uplink.rxInfo ?? []);
  const { battery_mv, battery_pct } = normalizeBattery(uplink.object);

  // Extract GPS coordinates — null if no fix
  const hasGps =
    uplink.object?.latitude !== undefined &&
    uplink.object?.longitude !== undefined &&
    (uplink.object.latitude !== 0 || uplink.object.longitude !== 0);

  const latitude = hasGps ? uplink.object!.latitude! : null;
  const longitude = hasGps ? uplink.object!.longitude! : null;
  const altitude = hasGps ? (uplink.object!.altitude ?? null) : null;

  return {
    device_eui: deviceEui,
    timestamp: uplink.time,
    latitude,
    longitude,
    altitude,
    accuracy_meters: null, // ChirpStack does not provide accuracy natively
    rssi: bestGw.rssi,
    snr: bestGw.snr,
    battery_mv,
    battery_pct,
    motion_detected: uplink.object?.motion ?? false,
    gateway_id: bestGw.gatewayId,
    gateway_rssi: bestGw.rssi,
    raw_payload: uplink.data ?? null,
    deduplication_id: uplink.deduplicationId,
  };
}

/**
 * Normalize a ChirpStack HTTP webhook body directly (no topic parsing needed).
 * The webhook body IS the uplink JSON; the event type is determined by the
 * endpoint path, so we assume it is an uplink.
 */
export function normalizeChirpStackWebhook(
  body: Record<string, unknown>,
): TrackerEvent | null {
  // Re-use the uplink normalizer with a synthetic topic
  const uplink = body as unknown as ChirpStackUplink;

  if (!uplink.deviceInfo?.devEui) {
    return null;
  }

  const syntheticTopic = `application/${uplink.deviceInfo.applicationId ?? '0'}/device/${uplink.deviceInfo.devEui}/event/up`;
  const buffer = Buffer.from(JSON.stringify(body), 'utf-8');
  return normalizeChirpStackEvent(syntheticTopic, buffer);
}
