// ---------------------------------------------------------------------------
// RV Trax API — Prometheus metrics endpoint
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import { roomManager } from '../websocket/server.js';

// Simple in-memory counters (reset on restart — production would use prom-client)
const counters = {
  http_requests_total: 0,
  http_errors_total: 0,
  ws_connections_total: 0,
  ws_messages_total: 0,
};

const histogramBuckets: number[] = [];
const startTime = Date.now();

export function incrementHttpRequests(): void {
  counters.http_requests_total++;
}

export function incrementHttpErrors(): void {
  counters.http_errors_total++;
}

export function incrementWsConnections(): void {
  counters.ws_connections_total++;
}

export function incrementWsMessages(): void {
  counters.ws_messages_total++;
}

export function recordLatency(ms: number): void {
  histogramBuckets.push(ms);
  // Keep last 1000 samples
  if (histogramBuckets.length > 1000) histogramBuckets.shift();
}

export default async function metricsRoutes(app: FastifyInstance): Promise<void> {
  // Track request count and latency
  app.addHook('onResponse', async (request, reply) => {
    incrementHttpRequests();
    if (reply.statusCode >= 500) incrementHttpErrors();
    recordLatency(reply.elapsedTime);
  });

  app.get('/metrics', async (_request, reply) => {
    const wsStats = roomManager.getStats();
    const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);

    const avgLatency = histogramBuckets.length > 0
      ? histogramBuckets.reduce((a, b) => a + b, 0) / histogramBuckets.length
      : 0;

    const p99Latency = histogramBuckets.length > 0
      ? histogramBuckets.slice().sort((a, b) => a - b)[Math.floor(histogramBuckets.length * 0.99)] ?? 0
      : 0;

    const lines = [
      '# HELP rvtrax_http_requests_total Total HTTP requests handled',
      '# TYPE rvtrax_http_requests_total counter',
      `rvtrax_http_requests_total ${counters.http_requests_total}`,
      '',
      '# HELP rvtrax_http_errors_total Total HTTP 5xx errors',
      '# TYPE rvtrax_http_errors_total counter',
      `rvtrax_http_errors_total ${counters.http_errors_total}`,
      '',
      '# HELP rvtrax_http_request_duration_ms_avg Average request duration in ms',
      '# TYPE rvtrax_http_request_duration_ms_avg gauge',
      `rvtrax_http_request_duration_ms_avg ${avgLatency.toFixed(2)}`,
      '',
      '# HELP rvtrax_http_request_duration_ms_p99 P99 request duration in ms',
      '# TYPE rvtrax_http_request_duration_ms_p99 gauge',
      `rvtrax_http_request_duration_ms_p99 ${p99Latency.toFixed(2)}`,
      '',
      '# HELP rvtrax_ws_active_connections Current WebSocket connections',
      '# TYPE rvtrax_ws_active_connections gauge',
      `rvtrax_ws_active_connections ${wsStats.totalConnections}`,
      '',
      '# HELP rvtrax_ws_active_rooms Current WebSocket rooms (dealerships)',
      '# TYPE rvtrax_ws_active_rooms gauge',
      `rvtrax_ws_active_rooms ${wsStats.roomCount}`,
      '',
      '# HELP rvtrax_ws_connections_total Total WebSocket connections since startup',
      '# TYPE rvtrax_ws_connections_total counter',
      `rvtrax_ws_connections_total ${counters.ws_connections_total}`,
      '',
      '# HELP rvtrax_ws_messages_total Total WebSocket messages since startup',
      '# TYPE rvtrax_ws_messages_total counter',
      `rvtrax_ws_messages_total ${counters.ws_messages_total}`,
      '',
      '# HELP rvtrax_uptime_seconds Server uptime in seconds',
      '# TYPE rvtrax_uptime_seconds gauge',
      `rvtrax_uptime_seconds ${uptimeSeconds}`,
      '',
    ];

    return reply.type('text/plain; version=0.0.4; charset=utf-8').send(lines.join('\n'));
  });
}
