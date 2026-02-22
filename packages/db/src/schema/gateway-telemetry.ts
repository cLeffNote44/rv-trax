import {
  integer,
  numeric,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Gateway Telemetry (will be converted to TimescaleDB hypertable via raw SQL)
// ---------------------------------------------------------------------------

export const gatewayTelemetry = pgTable('gateway_telemetry', {
  time: timestamp('time', { withTimezone: true }).notNull(),
  gatewayId: uuid('gateway_id').notNull(),
  cpuTempC: numeric('cpu_temp_c'),
  memoryUsedPct: numeric('memory_used_pct'),
  backhaulLatencyMs: numeric('backhaul_latency_ms'),
  packetsReceived: integer('packets_received'),
  packetsForwarded: integer('packets_forwarded'),
});
