// ---------------------------------------------------------------------------
// @rv-trax/iot-ingest — TypeScript type definitions
// ---------------------------------------------------------------------------

// ── Normalized tracker event from any LoRaWAN network server ────────────────

export interface TrackerEvent {
  /** Device EUI (unique hardware identifier, lowercase hex) */
  device_eui: string;
  /** ISO-8601 timestamp of the event from the network server */
  timestamp: string;
  /** GPS latitude in decimal degrees (-90 to 90), null if no fix */
  latitude: number | null;
  /** GPS longitude in decimal degrees (-180 to 180), null if no fix */
  longitude: number | null;
  /** Altitude in meters above sea level, null if unavailable */
  altitude: number | null;
  /** Estimated horizontal accuracy in meters, null if unavailable */
  accuracy_meters: number | null;
  /** Best RSSI value across all receiving gateways (dBm) */
  rssi: number;
  /** Best SNR value (dB) */
  snr: number;
  /** Battery voltage in millivolts */
  battery_mv: number;
  /** Battery percentage (0-100) */
  battery_pct: number;
  /** Whether the device detected motion */
  motion_detected: boolean;
  /** Gateway EUI that received the strongest signal */
  gateway_id: string;
  /** RSSI at the best gateway (dBm) */
  gateway_rssi: number;
  /** Base64-encoded raw LoRaWAN payload, null if not available */
  raw_payload: string | null;
  /** Network server deduplication ID */
  deduplication_id: string;
}

// ── Processing metrics ──────────────────────────────────────────────────────

export interface ProcessingMetrics {
  /** Total events received (MQTT + HTTP) */
  events_received: number;
  /** Events that passed validation */
  events_valid: number;
  /** Events rejected (invalid, dedup, rate-limited) */
  events_rejected: number;
  /** Events successfully pushed to Redis stream */
  events_processed: number;
  /** Current depth of the Redis iot:events stream */
  queue_depth: number;
  /** Seconds since service started */
  uptime_seconds: number;
}

// ── Validation result ───────────────────────────────────────────────────────

export interface ValidationResult {
  /** Whether the event was accepted and enqueued */
  accepted: boolean;
  /** Human-readable reason if rejected */
  reason?: string;
}

// ── Configuration interfaces ────────────────────────────────────────────────

export interface MqttConfig {
  brokerUrl: string;
  username?: string;
  password?: string;
}

export interface RedisConfig {
  url: string;
  streamKey: string;
  streamMaxLen: number;
}

export interface AppConfig {
  mqtt: MqttConfig;
  redis: RedisConfig;
  databaseUrl: string;
  host: string;
  port: number;
  chirpstackWebhookSecret?: string;
  rateLimitSeconds: number;
  dedupTtlSeconds: number;
}
