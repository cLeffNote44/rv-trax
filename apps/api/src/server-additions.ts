// ---------------------------------------------------------------------------
// RV Trax API — Phase 4 registration module
//
// Registers location history, real-time, gateway routes, WebSocket server,
// and gateway monitoring. Import and call from the main server.ts.
//
// Usage in server.ts:
//   import { registerPhase4Routes } from './server-additions.js';
//   // ... after other route registrations:
//   await registerPhase4Routes(app);
// ---------------------------------------------------------------------------

import type { FastifyInstance } from 'fastify';
import locationRoutes from './routes/locations.js';
import realtimeRoutes from './routes/realtime.js';
import gatewayRoutes from './routes/gateways.js';
import { setupWebSocket } from './websocket/server.js';
import { startGatewayMonitor, stopGatewayMonitor } from './services/gateway-monitor.js';

/**
 * Register all Phase 4 routes and services:
 * - Location history routes  (GET /api/v1/units/:id/location-history, etc.)
 * - Real-time status routes  (GET /api/v1/realtime/stats, POST /api/v1/units/:id/status — note: this mounts under /api/v1/realtime)
 * - Gateway CRUD + telemetry (GET/POST/PATCH/DELETE /api/v1/gateways)
 * - WebSocket server         (ws://host/ws)
 * - Gateway background monitor
 */
export async function registerPhase4Routes(app: FastifyInstance): Promise<void> {
  // ── Routes ----------------------------------------------------------------

  // Location routes are registered under /api/v1 since they define
  // sub-paths like /units/:id/location-history, /lots/:id/live-positions,
  // /trackers/:id/location-history
  await app.register(locationRoutes, { prefix: '/api/v1' });

  // Realtime routes: /api/v1/realtime/stats and /api/v1/realtime/units/:id/status
  await app.register(realtimeRoutes, { prefix: '/api/v1/realtime' });

  // Gateway routes: /api/v1/gateways
  await app.register(gatewayRoutes, { prefix: '/api/v1/gateways' });

  // ── WebSocket server -------------------------------------------------------
  // Must be set up after the HTTP server is ready. We use the 'onReady' hook
  // so the underlying Node.js HTTP server exists before we attach upgrade
  // handling.

  app.addHook('onReady', async () => {
    setupWebSocket(app, app.redis);
  });

  // ── Gateway monitor --------------------------------------------------------

  startGatewayMonitor(app.db, app.redis);

  // Stop on close
  app.addHook('onClose', async () => {
    stopGatewayMonitor();
  });

  app.log.info('Phase 4 routes and services registered');
}
